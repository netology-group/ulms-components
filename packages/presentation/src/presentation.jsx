/* eslint-disable max-len, react/prop-types, jsx-a11y/no-static-element-interactions, react/jsx-one-expression-per-line */
import React from 'react'
import cx from 'classnames-es'
import scrollIntoView from 'scroll-into-view-if-needed'
import VisibilitySensor from 'react-visibility-sensor'
import { Icons } from '@ulms/ui-icons'
import { SizeMe } from 'react-sizeme'
import { Spinner } from '@ulms/ui-spinner'

import css from './presentation.module.css'

function calculateSize (containerWidth, containerHeight, imageWidth, imageHeight) {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight)

  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  }
}

function calculateFitSize (containerWidth, containerHeight, imageWidth, imageHeight) {
  const scale = containerWidth / imageWidth

  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  }
}

export class Presentation extends React.Component {
  componentDidMount () {
    this.maybeScrollToActive()
  }

  componentDidUpdate (prevProps) {
    const { index } = this.props

    if (prevProps.index !== index) {
      this.maybeScrollToActive()
    }
  }

  handlePrevious = () => {
    const { index, onChange } = this.props

    if (index > 0) {
      onChange(index - 1)
    }
  }

  handleNext = () => {
    const {
      index, collection, onChange,
    } = this.props

    if (index < collection.length - 1) {
      onChange(index + 1)
    }
  }

  handleKeyDownEvent = (e) => {
    switch (e.keyCode) {
      case 33: // PageUp
      // falls through

      case 37: // ArrowLeft
        this.handlePrevious()

        break

      case 34: // PageDown
      // falls through

      case 39: // ArrowRight
        this.handleNext()

        break

      default:
      // Nothing to do here..
    }
  }

  maybeScrollToActive = () => {
    const { showPreviews } = this.props

    if (showPreviews) {
      this.scrollToActive()
    }
  }

  scrollToActive () {
    const element = this.container.querySelector(`.${css.preview}.${css.active}`)

    if (element) {
      scrollIntoView(element, {
        behavior: 'smooth',
        block: 'nearest',
        scrollMode: 'if-needed',
      })
    }
  }

  render () {
    const {
      index,
      collection,
      fitToWidth,
      onChange,
      showPagesCount,
      showActions,
      showPreviews,
      slotSlide,
    } = this.props

    return (
      <div
        ref={(ref) => { this.container = ref }}
        className={css.root}
        onKeyDown={this.handleKeyDownEvent}
        tabIndex={-1}
        data-presentation-root
      >
        {
          showPreviews && (
            <div className={css.listWrapper}>
              <div className={css.list}>
                {
                  collection.map((item, idx) => (
                    <div
                      className={cx(css.preview, idx === index && css.active)}
                      key={idx}
                      onClick={() => { onChange(idx) }}
                      onKeyPress={() => { onChange(idx) }}
                      role='button'
                      tabIndex={0}
                    >
                      <div className={css.number}>{item.page}</div>
                      <div className={css.image}>
                        <VisibilitySensor partialVisibility>
                          {({ isVisible }) => isVisible && item.preview
                            ? <img alt='preview' src={item.preview} />
                            : <div className={css.placeholder} />}
                        </VisibilitySensor>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )
        }
        <div className={css.slideWrapper}>
          <SizeMe monitorHeight>
            {({ size: { height, width } }) => {
              let result

              if (collection[index] && collection[index].image && height > 0 && width > 0) {
                const imageSize = fitToWidth
                  ? calculateFitSize(
                    width,
                    height,
                    collection[index].imageWidth,
                    collection[index].imageHeight
                  )
                  : calculateSize(
                    width,
                    height,
                    collection[index].imageWidth,
                    collection[index].imageHeight
                  )

                result = (
                  <div className={cx(css.slide, { [css.fitToWidth]: fitToWidth })}>
                    <img
                      alt='mainimage'
                      className={cx(css.mainImage, { [css.centered]: !fitToWidth })}
                      src={collection[index].image}
                      width={imageSize.width}
                      height={imageSize.height}
                    />
                    {
                      slotSlide && (
                        <div className={cx(css.slotSlide, { [css.centered]: !fitToWidth })}>
                          {slotSlide(imageSize.width, imageSize.height)}
                        </div>
                      )
                    }
                  </div>
                )
              } else {
                result = (
                  <div className={css.slide}>
                    <Spinner />
                  </div>
                )
              }

              return result
            }}
          </SizeMe>
          {
            collection[index] && (showPagesCount || (showActions && onChange)) && (
              <div className={css.controls}>
                {
                  showActions && onChange && (
                    <div>
                      <button
                        type='button'
                        className={css.linkArrow}
                        onClick={this.handlePrevious}
                        disabled={index === 0}
                        data-presentation-previous
                      >
                        <span className={css.linkArrowIcon}><Icons name='arrow-left' size='xs' /></span> Назад
                      </button>
                    </div>
                  )
                }
                {
                  showPagesCount && (
                    <div className={css.text}>
                      Страница {collection[index].page} из {collection.length}
                    </div>
                  )
                }
                {
                  showActions && onChange && (
                    <div>
                      <button
                        type='button'
                        className={css.linkArrow}
                        onClick={this.handleNext}
                        disabled={index === collection.length - 1}
                        data-presentation-next
                      >
                        Вперед <span className={css.linkArrowIcon}><Icons name='arrow-right' size='xs' /></span>
                      </button>
                    </div>
                  )
                }
              </div>
            )
          }
        </div>
      </div>
    )
  }
}
