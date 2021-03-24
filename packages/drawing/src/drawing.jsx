/* eslint-disable react/prop-types, max-classes-per-file */
import React from 'react'
import { fabric } from 'fabric'
import { queue as Queue } from 'd3-queue'
import Hammer from 'hammerjs'

import { toCSSColor } from './util/to-css-color'
import { LockProvider } from './lock-provider'

import DynamicPattern from './tools/dynamic-pattern'
// FIXME: fix cycle dep
// eslint-disable-next-line import/no-cycle
import EraserTool from './tools/eraser'
import { penToolModeEnum, shapeToolModeEnum, toolEnum } from './constants'
import './tools/optimized-pencil-brush'
import PanTool from './tools/pan'
import PenTool from './tools/pen'
import SelectTool from './tools/select'
import { LineTool } from './tools/line'
import { ShapeTool } from './tools/shape'
import { TextboxTool } from './tools/textbox'
// FIXME: fix cycle dep
// eslint-disable-next-line import/no-cycle
import { LockTool } from './tools/lock'
import {
  circle,
  circleSolid,
  rectangle,
  rectangleSolid,
  triangle,
  triangleSolid,
} from './tools/_shapes'

export const enhancedFields = [
  '_id',
  '_lockedbyuser',
  '_lockedselection',
  'noScaleCache',
  'strokeUniform',
]

export const normalizeFields = (object, fields) => Object.assign(
  object,
  fields.reduce((a, field) => {
    // eslint-disable-next-line no-param-reassign
    a[field] = object[field] || undefined

    return a
  }, {})
)

// TODO: use common tokenprovider
class TokenProvider {
  constructor () {
    this._provider = null
    this._rq = []
  }

  setProvider (provider) {
    this._provider = provider

    if (this._provider !== null) {
      this._provider()
        .then((token) => {
          this._rq.forEach((p) => {
            p.resolve(token)
          })

          this._rq = []

          return null
        })
        .catch(error => console.log(error)) // eslint-disable-line no-console
    }
  }

  getToken () {
    let p

    if (this._provider === null) {
      p = new Promise((resolve, reject) => {
        this._rq.push({ resolve, reject })
      })
    } else {
      p = this._provider()
    }

    return p
  }
}

const tp = new TokenProvider()

function matchesStorageURIScheme (url) {
  const re = /^.*\/api\/(.*)\/sets\/(.*)\/objects\/(.*)$/

  return url.match(re)
}

const originalFabricLoadImageFn = fabric.util.loadImage

fabric.util.loadImage = function loadImage (url, callback, context, crossOrigin) {
  if (matchesStorageURIScheme(url)) {
    tp.getToken()
      .then((token) => {
        if (url.indexOf('access_token') !== -1) {
          originalFabricLoadImageFn(url.replace(/\?access_token=(.*)$/i, `?access_token=${token}`), callback, context, crossOrigin)
        } else {
          originalFabricLoadImageFn(`${url}?access_token=${token}`, callback, context, crossOrigin)
        }

        return null
      })
      .catch(error => console.log(error)) // eslint-disable-line no-console
  } else {
    originalFabricLoadImageFn(url, callback, context, crossOrigin)
  }
}

function maybeRemoveToken (object) {
  if (object.type === 'image' && object.src.indexOf('?access_token=') !== -1) {
    object.src = object.src.split('?')[0] // eslint-disable-line
  }

  return object
}

function isShapeObject (object) {
  return object.type === shapeToolModeEnum.CIRCLE
    || object.type === shapeToolModeEnum.RECT
    || object.type === shapeToolModeEnum.TRIANGLE
}

function isTextObject (object) {
  return object.type === toolEnum.TEXT
}

export class Drawing extends React.Component {
  constructor (props) {
    super(props)

    this.canvas = null
    this.canvasPattern = null
    this.canvasRef = React.createRef()
    this.canvasPatternRef = React.createRef()
    this.dynamicPattern = null
    this.ignoreObjectRemovedEvent = false
    this.q = null
    this.rq = null
    this.tool = null

    this._hammer = null
    this._hammerCenter = null
    this._hammerDistance = null
    this._hammerPanActive = false
    this._hammerZoom = null

    const {
      _lockProvider,
      tokenProvider,
    } = this.props

    this.__lockProvider = _lockProvider || new LockProvider()
    this.__lockProvider.onUpdate(this._handleSelectionUpdate)

    if (!tokenProvider) throw new TypeError('Absent tokenProvider')

    this.__lockModeTool = null
  }

  componentDidMount () {
    const {
      canDraw, tool, objects, pattern, tokenProvider,
    } = this.props

    tp.setProvider(tokenProvider)

    if (canDraw) {
      this.initCanvas()
      this.initTool(tool)
    } else {
      this.initStaticCanvas()
    }

    if (pattern) {
      this.initCanvasPattern()

      this.dynamicPattern = new DynamicPattern(this.canvasPattern)

      this.updateCanvasPatternParameters()
      this.dynamicPattern.setPattern(pattern)
      this.updateCanvasPattern()
    }

    this.updateCanvasParameters(true)
    this.updateCanvasObjects(objects)
  }

  componentDidUpdate (prevProps) {
    const {
      brushColor,
      brushMode,
      brushWidth,
      canDraw,
      eraserWidth,
      height,
      objects,
      pattern,
      // onlineIds,
      shapeMode,
      tool,
      width,
      x,
      y,
      zoom,
    } = this.props

    if (prevProps.canDraw !== canDraw) {
      this.destroyQueues()
      this.destroyCanvas()

      this.canvasRef.current.style.position = 'relative'

      if (canDraw) {
        this.initCanvas()
        this.initTool(tool)
      } else {
        this.initStaticCanvas()
      }

      this.updateCanvasParameters(true)
      this.updateCanvasObjects(objects)
    }

    /* if (tool === prevProps.tool && tool === toolEnum.SELECT) {
      // FIXME: might not work for for three users (one come and one leave)
      if (onlineIds && (onlineIds.length !== prevProps.onlineIds.length)) {
        // SelectTool.updateAllSelection(this.canvas, onlineIds)
      }
    } */

    if (prevProps.pattern !== pattern) {
      if (pattern !== null) {
        if (!this.dynamicPattern) {
          this.initCanvasPattern()

          this.dynamicPattern = new DynamicPattern(this.canvasPattern)
          this.updateCanvasPatternParameters()
        }

        this.dynamicPattern.setPattern(pattern)
        this.updateCanvasPattern()
      } else {
        this.dynamicPattern.destroy()
        this.destroyCanvasPattern()

        this.dynamicPattern = null
      }
    }

    if (
      prevProps.height !== height
      || prevProps.width !== width
      || prevProps.x !== x
      || prevProps.y !== y
      || prevProps.zoom !== zoom
    ) {
      this.updateCanvasParameters()

      if (this.dynamicPattern) {
        this.updateCanvasPatternParameters()
        this.updateCanvasPattern()
      }
    }

    if (prevProps.objects && objects && prevProps.objects !== objects) {
      this.updateCanvasObjects(objects)
    }

    if (
      canDraw
      && (
        prevProps.tool !== tool
        || prevProps.brushColor !== brushColor
        || prevProps.shapeMode !== shapeMode
        || tool === toolEnum.PEN // need to update the tool if it's a pen
      )
    ) {
      this.initTool(tool)
    }

    if (
      canDraw
      && (
        prevProps.brushColor !== brushColor
        || prevProps.brushMode !== brushMode
        || prevProps.brushWidth !== brushWidth
        || prevProps.eraserWidth !== eraserWidth
        || prevProps.shapeMode !== shapeMode
      )
    ) {
      this.configureTool()
    }
  }

  componentWillUnmount () {
    tp.setProvider(null)

    this.destroyQueues()

    this.destroyHammer()

    if (this.dynamicPattern) {
      this.dynamicPattern.destroy()
      this.destroyCanvasPattern()

      this.dynamicPattern = null
    }

    if (this.__lockProvider) {
      this.__lockProvider = null
    }

    this.destroyCanvas()
  }

  get LockProvider () {
    return this.__lockProvider
  }

  _handleSelectionUpdate = (prev, changed) => {
    const { tool } = this.props

    if (tool === toolEnum.SELECT && changed) {
      const isLocked = this.LockProvider.isLocked.bind(this.LockProvider)
      const isOwner = this.LockProvider.isOwner.bind(this.LockProvider)

      SelectTool.updateAllSelection(this.canvas, isLocked, isOwner)
    }
  }

  _handleKeyDown = (opts) => {
    this.tool.handleKeyDownEvent(opts)
  }

  _handleKeyUp = (opts) => {
    this.tool.handleKeyUpEvent(opts)
  }

  _handleMouseDown = (opts) => {
    this.tool.handleMouseDownEvent(opts)
  }

  _handleMouseMove = (opts) => {
    const { onMouseMove } = this.props

    this.tool.handleMouseMoveEvent(opts)
    onMouseMove && onMouseMove({ ...opts, vptCoords: this.canvas.vptCoords })
  }

  _handleMouseUp = (opts) => {
    this.tool.handleMouseUpEvent(opts)
  }

  _handleTextEditStartEvent = (opts) => {
    this.tool.handleTextEditStartEvent(opts)
  }

  _handleTextEditEndEvent = (opts) => {
    this.tool.handleTextEditEndEvent(opts)
  }

  _handleSelectionUpdatedEvent = (opts) => {
    this.tool.handleSelectionUpdatedEvent(opts)
  }

  _handleSelectionCreatedEvent = (opts) => {
    this.tool.handleSelectionCreatedEvent(opts)
  }

  _handleSelectionClearedEvent = (opts) => {
    this.tool.handleSelectionClearedEvent(opts)
  }

  _handleObjectAdded = (opts) => {
    this.tool.handleObjectAddedEvent(opts)
  }

  _handleAfterRender = () => {
    const { onAfterRender } = this.props

    this.updateCanvasPattern()

    onAfterRender && onAfterRender()
  }

  initCanvas () {
    const {
      selectOnInit,
      clientId,
      uniqId,
    } = this.props

    this.canvas = new fabric.Canvas('canvas', {
      enablePointerEvents: 'PointerEvent' in window,
    })
    this.canvas._id = clientId
    this.canvas.freeDrawingBrush = new fabric.OptimizedPencilBrush(this.canvas)

    this.canvas.on('mouse:down', opt => this._handleMouseDown(opt))
    this.canvas.on('mouse:move', opt => this._handleMouseMove(opt))
    this.canvas.on('mouse:up', opt => this._handleMouseUp(opt))
    this.canvas.on('object:added', opt => this._handleObjectAdded(opt))
    this.canvas.on('text:editing:entered', opt => this._handleTextEditStartEvent(opt))
    this.canvas.on('text:editing:exited', opt => this._handleTextEditEndEvent(opt))
    this.canvas.on('selection:updated', opt => this._handleSelectionUpdatedEvent(opt))
    this.canvas.on('selection:created', opt => this._handleSelectionCreatedEvent(opt))
    this.canvas.on('selection:cleared', opt => this._handleSelectionClearedEvent(opt))

    this.canvasRef.current.ownerDocument.addEventListener('keydown', this._handleKeyDown)
    this.canvasRef.current.ownerDocument.addEventListener('keyup', this._handleKeyUp)

    this.canvas.on('object:added', (event) => {
      const { onDraw } = this.props
      const object = event.target
      let serializedObj

      // Skipping draft objects
      if (object._draft) return

      if (!object.remote) {
        object._id = uniqId()
        serializedObj = object.toObject(enhancedFields)

        if (selectOnInit && isShapeObject(object)) return
        if (isTextObject(object)) return

        onDraw && onDraw(maybeRemoveToken(serializedObj))
      } else {
        delete object.remote
      }
    })

    this.canvas.on('selection:cleared', ({ deselected }) => {
      if (!deselected || deselected.length !== 1) return

      const { onDraw } = this.props
      const [object] = deselected

      if (isShapeObject(object)) {
        const serializedObj = object.toObject(enhancedFields)

        if (object._new) {
          onDraw && onDraw(maybeRemoveToken(serializedObj))
          object.set('_new', undefined)
        }
      }
    })

    this.canvas.on('object:modified', (event) => {
      const { onDraw, onDrawUpdate } = this.props
      const object = event.target

      // Skipping draft objects
      if (object._draft) return

      const serializedObj = object.toObject(enhancedFields)

      if (isTextObject(object) && object._textBeforeEdit === '') {
        onDraw && onDraw(maybeRemoveToken(serializedObj))
      } else if (isShapeObject(object)) {
        object._new
          ? onDraw && onDraw(maybeRemoveToken(serializedObj))
          : onDrawUpdate && onDrawUpdate(maybeRemoveToken(serializedObj))

        object.set('_new', undefined)
      } else {
        onDrawUpdate && onDrawUpdate(maybeRemoveToken(serializedObj))
      }
    })

    this.canvas.on('object:removed', (event) => {
      if (this.ignoreObjectRemovedEvent) return

      const { onObjectRemove } = this.props
      const object = event.target

      // Skipping draft objects
      if (object._draft) return

      onObjectRemove && onObjectRemove(maybeRemoveToken(object.toObject(enhancedFields)))
    })

    this.canvas.on('after:render', () => this._handleAfterRender())

    if (!this._hammer) {
      this.initHammer(this.canvas.upperCanvasEl)
    }

    // this.canvas.on('mouse:wheel', (opt) => {
    //   const delta = opt.e.deltaY
    //   let zoom = this.canvas.getZoom()
    //
    //   zoom += delta / 200
    //
    //   if (zoom > 2) zoom = 2
    //   if (zoom < 0.5) zoom = 0.5
    //
    //   this.canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom)
    //
    //   opt.e.preventDefault()
    //   opt.e.stopPropagation()
    // })
  }

  initCanvasPattern () {
    this.canvasPattern = new fabric.StaticCanvas('canvasPattern')
  }

  initStaticCanvas () {
    this.canvas = new fabric.StaticCanvas('canvas')
  }

  updateCanvasPattern () {
    if (this.dynamicPattern) {
      this.dynamicPattern.update({
        offsetX: this.canvas.viewportTransform[4],
        offsetY: this.canvas.viewportTransform[5],
        zoom: this.canvas.getZoom(),
      })
    }
  }

  destroyCanvas () {
    if (this.canvas !== null) {
      this.canvas.clear()
      this.canvas.dispose()

      this.__cleanTools()
      this.canvasRef.current.ownerDocument.removeEventListener('keydown', this._handleKeyDown)
      this.canvasRef.current.ownerDocument.removeEventListener('keyup', this._handleKeyUp)

      this.canvas = null
    }
  }

  destroyCanvasPattern () {
    if (this.canvasPattern !== null) {
      this.canvasPattern.clear()
      this.canvasPattern.dispose()

      this.canvasPattern = null
    }
  }

  destroyQueues () {
    if (this.q !== null) {
      this.q.abort()

      this.q = null
    }

    if (this.rq !== null) {
      this.rq.abort()

      this.rq = null
    }
  }

  initTool (tool) {
    const {
      brushColor,
      brushMode,
      isPresentation,
      onLockDeselection,
      onLockSelection,
      selectOnInit,
      shapeMode,
    } = this.props

    this.tool && this.tool.destroy()

    switch (tool) {
      case toolEnum.ERASER:
        this.tool = new EraserTool(this.canvas)

        break

      case toolEnum.PAN:
        this.tool = new PanTool(this.canvas)

        break

      case toolEnum.PEN:
        if (brushMode === penToolModeEnum.LINE) {
          this.tool = new LineTool(this.canvas)
        } else {
          this.tool = new PenTool(this.canvas)
        }
        break

      case toolEnum.SELECT:
        this.tool = new SelectTool(this.canvas, { isPresentation })

        break

      case toolEnum.TEXT:
        this.tool = new TextboxTool(this.canvas, undefined, {
          fill: toCSSColor(brushColor),
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        })

        break

      case toolEnum.SHAPE:
        switch (shapeMode) {
          case shapeToolModeEnum.CIRCLE:
            this.tool = new ShapeTool(
              this.canvas,
              () => circle({ stroke: toCSSColor(brushColor) }),
              {
                adjustCenter: '-0.5 -0.5',
                selectOnInit,
              }
            )

            break

          case shapeToolModeEnum.CIRCLE_SOLID:
            this.tool = new ShapeTool(
              this.canvas,
              () => circleSolid({ fill: toCSSColor(brushColor) }),
              {
                adjustCenter: '-0.5 -0.5',
                selectOnInit,
              }
            )

            break

          case shapeToolModeEnum.RECT:
            this.tool = new ShapeTool(
              this.canvas,
              () => rectangle({
                width: 97.2,
                height: 97.2,
                stroke: toCSSColor(brushColor),
              }),
              {
                adjustCenter: '0 -1',
                selectOnInit,
              }
            )

            break

          case shapeToolModeEnum.RECT_SOLID:
            this.tool = new ShapeTool(
              this.canvas,
              () => rectangleSolid({
                width: 97.2,
                height: 97.2,
                fill: toCSSColor(brushColor),
              }),
              {
                adjustCenter: '0 -1',
                selectOnInit,
              }
            )

            break

          case shapeToolModeEnum.TRIANGLE:
            this.tool = new ShapeTool(
              this.canvas,
              () => triangle({
                width: 97.2,
                height: 97.2,
                stroke: toCSSColor(brushColor),
              }),
              {
                adjustCenter: '0 -1',
                selectOnInit,
              }
            )

            break

          case shapeToolModeEnum.TRIANGLE_SOLID:
            this.tool = new ShapeTool(
              this.canvas,
              () => triangleSolid({
                fill: toCSSColor(brushColor),
                height: 97.2,
                width: 97.2,
              }),
              {
                adjustCenter: '0 -1',
                selectOnInit,
              }
            )

            break

          default:
            this.tool = new ShapeTool(
              this.canvas,
              () => rectangle({
                width: 97.2,
                height: 97.2,
                stroke: toCSSColor(brushColor),
              }),
              {
                adjustCenter: '0 -1',
                selectOnInit,
              }
            )
        }

        break

      default:
        this.tool = new PenTool(this.canvas)
    }

    this.__cleanTools()
    this.__lockModeTool = new LockTool(this.canvas, onLockSelection, onLockDeselection)

    this.configureTool(true)
  }

  configureTool (initial = false) {
    const {
      brushColor, brushMode, brushWidth, eraserWidth, eraserPrecision, tool,
    } = this.props

    if (tool === toolEnum.PEN) {
      const color = brushMode === penToolModeEnum.MARKER
        ? { ...brushColor, a: 0.5 }
        : brushColor

      this.tool.configure({
        lineColor: toCSSColor(color),
        lineWidth: brushWidth,
      })
    } else {
      this.tool.configure({
        lineColor: toCSSColor(brushColor),
        lineWidth: brushWidth,
        precision: eraserPrecision,
        eraserWidth,
        initial,
      })
    }
  }

  initHammer (element) {
    Hammer.defaults.touchAction = 'none'

    this._hammer = new Hammer(element)

    this._hammer.get('pan').set({ pointers: 2, threshold: 0 })

    this._hammer.on('panstart panmove panend pancancel', (event) => {
      // eslint-disable-next-line max-len
      const distance = Math.round(Math.sqrt((event.pointers[1].x - event.pointers[0].x) ** 2 + (event.pointers[1].y - event.pointers[0].y) ** 2))

      if (event.type === 'panstart') {
        if (this.tool) {
          this.tool.makeInactive()
          this.tool.reset()
        }

        this._hammerCenter = event.center
        this._hammerDistance = distance
        this._hammerPanActive = true
        this._hammerZoom = this.canvas.getZoom()
      } else if (event.type === 'panmove') {
        if (!this._hammerPanActive) return

        const zoom = this._hammerZoom
        let newZoom = zoom + 0.005 * (distance - this._hammerDistance)

        if (newZoom > 2) newZoom = 2
        if (newZoom < 0.2) newZoom = 0.2

        newZoom = parseFloat(newZoom.toPrecision(3))

        this.canvas.viewportTransform[4] += event.center.x - this._hammerCenter.x
        this.canvas.viewportTransform[5] += event.center.y - this._hammerCenter.y

        if (newZoom !== zoom) {
          this.canvas.zoomToPoint(event.center, newZoom)
        } else {
          this.canvas.requestRenderAll()
        }

        this._hammerCenter = event.center
        this._hammerDistance = distance
        this._hammerZoom = newZoom
      } else if (event.type === 'panend' || event.type === 'pancancel') {
        if (!this._hammerPanActive) return

        const newZoom = parseFloat(this._hammerZoom.toPrecision(2))

        this.canvas.zoomToPoint(event.center, newZoom)

        if (this.tool) {
          this.tool.makeActive()
        }

        this._hammerCenter = null
        this._hammerDistance = null
        this._hammerPanActive = false
        this._hammerZoom = null
      }
    })
  }

  destroyHammer () {
    if (this._hammer) {
      this._hammer.destroy()

      this._hammer = null
    }
  }

  addImage (url, options) {
    fabric.Image.fromURL(url, (image) => {
      const { tl, br } = this.canvas.calcViewportBoundaries()

      image.set({
        left: br.x - (br.x - tl.x) / 2 - image.width / 2,
        top: br.y - (br.y - tl.y) / 2 - image.height / 2,
      })

      this.canvas.add(image)
    }, options)
  }

  updateCanvasParameters (forced = false) {
    const {
      height,
      width,
      x,
      y,
      zoom,
      zoomToCenter,
    } = this.props
    const { tl } = this.canvas.calcViewportBoundaries()
    const currentDimensions = {
      height: this.canvas.getHeight(),
      width: this.canvas.getWidth(),
      ...tl,
      zoom: this.canvas.getZoom(),
    }
    const dimensionsChanged = currentDimensions.height !== height
      || currentDimensions.width !== width
    const viewportChanged = currentDimensions.x !== x || currentDimensions.y !== y
    const zoomChanged = currentDimensions.zoom !== zoom

    // dimensions
    if (forced || dimensionsChanged) {
      this.canvas.setDimensions({ height, width })
    }

    // viewport
    if (forced || viewportChanged) {
      this.canvas.absolutePan({ x: x * currentDimensions.zoom, y: y * currentDimensions.zoom })
    }

    // zoom
    if (forced) {
      this.canvas.setZoom(zoom)
    } else if (zoomChanged) {
      if (zoomToCenter && !dimensionsChanged && !viewportChanged) {
        this.canvas.zoomToPoint({ x: width / 2, y: height / 2 }, zoom)
      } else {
        this.canvas.setZoom(zoom)
      }
    }
  }

  updateCanvasPatternParameters () {
    const { height, width } = this.props

    if (height && width) {
      this.canvasPattern.setDimensions({ height, width })
    }
  }

  _updateCanvasObjects (canvasObjects, objects) {
    const canvasObjectIds = canvasObjects.map(_ => _._id)
    const newObjectIds = new Set(objects.map(_ => _._id))
    const objectsToAdd = []
    const objectsToRemove = []
    const enlivenedObjects = new Map()

    // const { onlineIds } = this.props

    this.destroyQueues()

    this.q = new Queue(50)
    this.rq = new Queue(50)

    this.canvas.renderOnAddRemove = false

    canvasObjects.forEach((_) => {
      if (!newObjectIds.has(_._id)) {
        objectsToRemove.push(_)
      }
    })

    objects.forEach((_) => {
      const objIndex = canvasObjectIds.indexOf(_._id)
      const nextObject = normalizeFields(_, enhancedFields)
      const { _lockedselection: selection } = nextObject

      if (objIndex === -1) {
        // add

        // if (nextObject._lockedselection && !onlineIds.includes(nextObject._lockedselection)) {
        if (selection && !this.LockProvider.isLocked(selection)) {
          nextObject._lockedselection = undefined
          // cleanup selection if present but is not locked according the provider
        }

        objectsToAdd.push(nextObject)
      } else {
        // update (only if revision has been changed)
        if (_._rev === canvasObjects[objIndex]._rev) {
          return
        }

        if (_._lockedselection !== canvasObjects[objIndex]._lockedselection) {
          SelectTool.updateObjectSelection(this.canvas, nextObject)
        }

        canvasObjects[objIndex].set(nextObject)

        !LockTool.isLocked(canvasObjects[objIndex])
          ? LockTool.unlockObject(canvasObjects[objIndex])
          : LockTool.lockObject(canvasObjects[objIndex])

        canvasObjects[objIndex].setCoords()
      }
    })

    return {
      objects,
      objectsToAdd,
      objectsToRemove,
      enlivenedObjects,
    }
  }

  updateCanvasObjects (_objects) {
    const canvasObjects = this.canvas.getObjects()
    const {
      objects,
      objectsToAdd,
      objectsToRemove,
      enlivenedObjects,
    } = this._updateCanvasObjects(canvasObjects, _objects)

    if (objectsToRemove.length > 0) {
      this.ignoreObjectRemovedEvent = true
      this.canvas.remove(...objectsToRemove)
      this.ignoreObjectRemovedEvent = false
    }

    if (objectsToAdd.length) {
      objectsToAdd
        .map(_ => ({ ..._, remote: true }))
        .forEach((_) => {
          this.q.defer((done) => {
            window.requestAnimationFrame(() => {
              fabric.util.enlivenObjects([_], ([fObject]) => {
                if (fObject) {
                  enlivenedObjects.set(fObject._id, fObject)
                }

                done(null)
              })
            })
          })
        })

      this.q.awaitAll((error) => {
        if (error) {
          return
        }

        this.canvas.renderOnAddRemove = false

        const { objects: _o } = this.props
        const newObjectIdsAgain = new Set(_o.map(_ => _._id))

        objects.forEach((object) => {
          if (!enlivenedObjects.has(object._id)) {
            return
          }

          this.rq.defer((done) => {
            // With requestAnimationFrame objects may be duplicated on canvas
            if (this.canvas === null) {
              done()

              return
            }

            // Bypass objects which should be invalidated
            if (!newObjectIdsAgain.has(object._id) && !object._invalidate) {
              done()

              return
            }

            const objectToAdd = enlivenedObjects.get(object._id)

            if (LockTool.isLocked(objectToAdd)) {
              LockTool.lockObject(objectToAdd)
            }

            this.canvas.add(objectToAdd)

            done(null)
          })
        })

        this.rq.awaitAll((rqError) => {
          if (rqError) {
            return
          }

          this.canvas.renderOnAddRemove = true
          this.canvas.requestRenderAll()
        })
      })
    } else {
      this.canvas.renderOnAddRemove = true
      this.canvas.requestRenderAll()
    }
  }

  cleanSelection () {
    if (this.canvas.getActiveObject()) this.canvas.discardActiveObject()
  }

  currentSelection () {
    return this.canvas.getActiveObject().toObject(enhancedFields)
  }

  __cleanTools () {
    this.__lockModeTool && this.__lockModeTool.destroy()

    this.__lockModeTool = undefined
  }

  render () {
    const {
      height, width, pattern,
    } = this.props

    return (
      <>
        <canvas id='canvasPattern' ref={this.canvasPatternRef} width={width} height={height} style={{ display: pattern ? 'block' : 'none', position: 'absolute' }} />
        <canvas id='canvas' ref={this.canvasRef} width={width} height={height} />
      </>
    )
  }
}

Drawing.defaultProps = {
  brushColor: {
    r: 255, g: 255, b: 255, a: 1,
  },
  brushWidth: 12,
  shapeMode: shapeToolModeEnum.RECT,
  tool: toolEnum.PEN,
  x: 0,
  y: 0,
  zoom: 1,
  zoomToCenter: false,
}
