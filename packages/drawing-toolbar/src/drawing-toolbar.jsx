import React from 'react'
import cn from 'classnames-es'
import { cond } from 'ramda'
import { Icons } from '@ulms/ui-icons'
import { penToolModeEnum, shapeToolModeEnum, toolEnum } from '@ulms/ui-drawing/src/constants'

import { GroupColor } from './group-color'
import { GroupEraser } from './group-eraser'
import { GroupPen } from './group-pen'
import { GroupShape } from './group-shape'
import { Shapes } from './shapes'

import 'rc-slider/assets/index.css'
// TODO: move slider assets to css-module

import css from './drawing-toolbar.module.css'
import IconElementEraser from './icons/icon-tool-element-eraser.svg'
import IconFitIn from './icons/icon-tool-fit-in.svg'
import IconFitOut from './icons/icon-tool-fit-out.svg'
import IconGrid from './icons/icon-tool-grid.svg'
import IconImage from './icons/icon-tool-image.svg'
import IconLine from './icons/icon-tool-line.svg'
import IconMarker from './icons/icon-tool-marker.svg'
import IconPan from './icons/icon-tool-pan.svg'
import IconPencil from './icons/icon-tool-pencil.svg'
import IconSelect from './icons/icon-tool-select.svg'
import IconText from './icons/icon-tool-text.svg'
import IconZoomIn from './icons/icon-tool-zoom-in.svg'
import IconZoomOut from './icons/icon-tool-zoom-out.svg'
import { toCSSColor } from './utils'

function supportPointerEvent () {
  return 'PointerEvent' in window
}

const eventName = supportPointerEvent() ? 'pointerdown' : 'mousedown'

export class DrawingToolbar extends React.Component {
  state = { opened: null }

  constructor () {
    super()

    this.handleDocumentClickEvent = this.handleDocumentClickEvent.bind(this)
  }

  componentDidMount () {
    document.addEventListener(eventName, this.handleDocumentClickEvent)
  }

  // FIXME: :point_down:
  // eslint-disable-next-line react/no-deprecated
  componentWillReceiveProps (nextProps) {
    const { tool } = this.props

    const toolHasChanged = nextProps.tool !== tool
    const notEraser = nextProps.tool !== toolEnum.ERASER
    const notPen = nextProps.tool !== toolEnum.PEN
    const notShape = nextProps.tool !== toolEnum.SHAPE

    if (toolHasChanged && notEraser && notPen && notShape) {
      this.setState({ opened: null })
    }
  }

  componentWillUnmount () {
    document.removeEventListener(eventName, this.handleDocumentClickEvent)
  }

  handleSelectClick = () => {
    const { handleChange } = this.props

    handleChange({ tool: toolEnum.SELECT })
  }

  handleEraserClick = () => {
    const { handleChange } = this.props

    handleChange({ tool: toolEnum.ERASER })
    this.toggleOpened('group-eraser')
  }

  handlePenClick = () => {
    const { handleChange, tool } = this.props

    if (tool !== toolEnum.PEN) {
      handleChange({ tool: toolEnum.PEN })
    }
    this.toggleOpened('group-pen')
  }

  handleColorClick = () => this.toggleOpened('group-color')

  handleImageClick = () => {
    const { handleChange, onImageToolClick } = this.props

    handleChange({ tool: toolEnum.SELECT })
    onImageToolClick()
  }

  handleShapeClick = () => {
    const { handleChange, tool } = this.props

    if (tool !== toolEnum.SHAPE) {
      handleChange({ tool: toolEnum.SHAPE })
    }
    this.toggleOpened('group-shape')
  }

  handleTextClick = () => {
    const { handleChange } = this.props

    handleChange({ tool: toolEnum.TEXT })
  }

  handleLockClick = () => {
    const { onLock, handleChange } = this.props

    handleChange({ tool: toolEnum.SELECT })
    onLock()
  }

  handleZoomInClick = () => {
    const { handleChange, zoom } = this.props

    handleChange({ zoom: (zoom + 0.2) >= 2 ? 2 : zoom + 0.2 })
  }

  handleZoomOutClick = () => {
    const { handleChange, zoom } = this.props

    handleChange({ zoom: (zoom - 0.2) <= 0.2 ? 0.2 : zoom - 0.2 })
  }

  handleFitClick = () => {
    const { fit, handleChange } = this.props

    handleChange({ fit: !fit })
  }

  handlePanClick = () => {
    const { handleChange } = this.props

    handleChange({ tool: toolEnum.PAN })
  }

  handleGridClick = () => {
    const { handleChange, grid } = this.props

    handleChange({ grid: !grid })
  }

  handleDocumentClickEvent (event) {
    const { opened } = this.state

    if (opened === null) return

    // TODO: remove implicit functional based on classnames
    const closestToolbarElement = event.target.closest(`.${css.root}`)
    const closestFloaterElement = event.target.closest(`.${css.floater}`)

    if (closestToolbarElement === null && closestFloaterElement === null) {
      this.setState({ opened: null })
    }
  }

  toggleOpened (val) {
    const { opened } = this.state

    this.setState({ opened: val !== opened ? val : null })
  }

  render () {
    const {
      brushColor,
      brushMode,
      brushWidth,
      eraserWidth,
      fit,
      grid,
      handleChange,
      hasLockSelection,
      shapeMode,
      tool,
      tools,
      zoom,
    } = this.props
    const { opened } = this.state

    const isColorEnabled = tools && tools.includes('color')
    const isEraserEnabled = tools && tools.includes(toolEnum.ERASER)
    const isFitEnabled = tools && tools.includes('fit')
    const isGridEnabled = tools && tools.includes('grid')
    const isImageEnabled = tools && tools.includes('image')
    const isLockEnabled = tools && tools.includes('lock')
    const isPanEnabled = tools && tools.includes(toolEnum.PAN)
    const isPenEnabled = tools && tools.includes(toolEnum.PEN)
    const isSelectEnabled = tools && tools.includes(toolEnum.SELECT)
    const isShapeEnabled = tools && tools.includes(toolEnum.SHAPE)
    const isTextEnabled = tools && tools.includes(toolEnum.TEXT)
    const isZoomEnabled = tools && tools.includes('zoom')

    return (
      <div className={css.root}>
        <div className={css.col} style={{ color: toCSSColor(brushColor) }}>
          { isSelectEnabled && (
            <div
              className={cn(css.button, { [css.active]: tool === toolEnum.SELECT })}
              onClick={this.handleSelectClick}
              onKeyDown={this.handleSelectClick}
              role='button'
              tabIndex='0'
              title='Выбрать (V)'
            >
              <IconSelect />
            </div>
          )}

          { isPenEnabled && (
            <div
              className={cn(css.button, css.group, 'group-pen', { [css.active]: tool === toolEnum.PEN || opened === 'group-pen' })}
              onClick={this.handlePenClick}
              onKeyDown={this.handlePenClick}
              role='button'
              tabIndex='0'
              title={brushMode === penToolModeEnum.MARKER ? 'Маркер' : brushMode === penToolModeEnum.LINE ? 'Линия (L)' : 'Карандаш (P)'}
            >
              {
                    cond([
                      [_ => _ === penToolModeEnum.PENCIL, () => <IconPencil />],
                      [_ => _ === penToolModeEnum.MARKER, () => <IconMarker />],
                      [_ => _ === penToolModeEnum.LINE, () => <IconLine />],
                      [() => true, () => <IconPencil />],
                    ])(brushMode)
                  }
            </div>
          )}

          { isEraserEnabled && (
            <div
              className={cn(css.button, css.group, 'group-eraser', { [css.active]: tool === toolEnum.ERASER || opened === 'eraser' })}
              onClick={this.handleEraserClick}
              onKeyDown={this.handleEraserClick}
              role='button'
              tabIndex='0'
              title='Ластик (E)'
            >
              <IconElementEraser />
            </div>
          )}

          { isColorEnabled && (
            <div
              className={cn(css.button, css.group, 'group-color', { [css.active]: opened === 'group-color' })}
              onClick={this.handleColorClick}
              onKeyDown={this.handleColorClick}
              role='button'
              tabIndex='0'
              title='Цвет'
            >
              <div
                className={css.colorButtonInner}
                style={{ background: brushColor ? toCSSColor(brushColor) : '#000' }}
              />
            </div>
          )}

          { isImageEnabled && (
            <div
              className={css.button}
              onClick={this.handleImageClick}
              onKeyDown={this.handleImageClick}
              role='button'
              tabIndex='0'
              title='Загрузить изображение'
            >
              <IconImage />
            </div>
          )}

          { isShapeEnabled && (
            <div
              className={cn(css.button, css.group, 'group-shape', { [css.active]: tool === toolEnum.SHAPE || opened === 'group-shape' })}
              onClick={this.handleShapeClick}
              onKeyDown={this.handleShapeClick}
              role='button'
              tabIndex='0'
              title='Фигура'
            >
              {
                cond([
                  [_ => _ === shapeToolModeEnum.CIRCLE, () => <Shapes shape='circle' />],
                  [_ => _ === shapeToolModeEnum.CIRCLE_SOLID, () => <Shapes shape='circle' solid />],
                  [_ => _ === shapeToolModeEnum.RECT, () => <Shapes shape='square' />],
                  [_ => _ === shapeToolModeEnum.RECT_SOLID, () => <Shapes shape='square' solid />],
                  [_ => _ === shapeToolModeEnum.TRIANGLE, () => <Shapes shape='triangle' />],
                  [_ => _ === shapeToolModeEnum.TRIANGLE_SOLID, () => <Shapes shape='triangle' solid />],
                  [() => true, () => <Shapes shape='square' />],
                ])(shapeMode)
              }
            </div>
          )}

          { isTextEnabled && (
            <div
              className={cn(css.button, { [css.active]: tool === toolEnum.TEXT })}
              onClick={this.handleTextClick}
              onKeyDown={this.handleTextClick}
              role='button'
              tabIndex='0'
              title='Текст (T)'
            >
              <div className={css.buttonInner}>
                <IconText />
              </div>
            </div>
          )}

          { isLockEnabled && (
            <button
              className={css.button}
              disabled={!hasLockSelection}
              onClick={this.handleLockClick}
              type='button'
            >
              <div className={cn(css.buttonInner, css.svgStroke)} title='Изменить блокировку'>
                <Icons name='lock-outline' />
              </div>
            </button>
          )}

          { isZoomEnabled && (
            <>
              <div className={css.separator} />
              <div
                className={css.button}
                onClick={this.handleZoomInClick}
                onKeyDown={this.handleZoomInClick}
                role='button'
                tabIndex='0'
                title='Увеличить'
              >
                <IconZoomIn />
              </div>
              <div className={css.text}>{`${parseFloat((zoom * 100).toFixed(1))}%`}</div>
              <div
                className={css.button}
                onClick={this.handleZoomOutClick}
                onKeyDown={this.handleZoomOutClick}
                role='button'
                tabIndex='0'
                title='Уменьшить'
              >
                <IconZoomOut />
              </div>
            </>
          )}

          { isFitEnabled && (
            <div
              className={css.button}
              onClick={this.handleFitClick}
              onKeyDown={this.handleFitClick}
              role='button'
              tabIndex='0'
            >
              {fit ? <IconFitOut /> : <IconFitIn />}
            </div>
          )}

          { isPanEnabled && (
            <div
              className={cn(css.button, { [css.active]: tool === toolEnum.PAN })}
              onClick={this.handlePanClick}
              onKeyDown={this.handlePanClick}
              role='button'
              tabIndex='0'
              title='Перемещение доски'
            >
              <IconPan />
            </div>
          )}

          { isGridEnabled && (
            <div
              className={cn(css.button, { [css.active]: grid })}
              onClick={this.handleGridClick}
              onKeyDown={this.handleGridClick}
              role='button'
              tabIndex='0'
              title='Фоновая сетка'
            >
              <IconGrid />
            </div>
          )}

          { isPenEnabled && (
            <GroupPen
              brushMode={brushMode}
              brushWidth={brushWidth}
              css={css}
              handleChange={handleChange}
              opened={opened}
              tool={tool}
            />
          )}

          { isEraserEnabled && (
            <GroupEraser
              css={css}
              eraserWidth={eraserWidth}
              handleChange={handleChange}
              opened={opened}
            />
          )}

          { isColorEnabled && (
            <GroupColor
              brushColor={brushColor}
              css={css}
              handleChange={handleChange}
              opened={opened}
            />
          )}

          { isShapeEnabled && (
            <GroupShape
              brushColor={brushColor}
              css={css}
              handleChange={handleChange}
              opened={opened}
              shapeMode={shapeMode}
              tool={tool}
            />
          )}
        </div>
      </div>
    )
  }
}
