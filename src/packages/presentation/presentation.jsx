/* eslint-disable react/prop-types */
import React, { Component } from 'react'
import { SizeMe } from 'react-sizeme'
import VisibilitySensor from 'react-visibility-sensor'
import scrollIntoView from 'scroll-into-view-if-needed'
import cx from 'classnames'

import { Icons } from '../icons/icons'
import { Spinner } from '../spinner/spinner'

import css from './presentation.css'

function calculateSize (containerWidth, containerHeight, imageWidth, imageHeight) {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight)

  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  }
}

class Presentation extends Component {
  constructor () {
    super()

    this.handlePrevious = this.handlePrevious.bind(this)
    this.handleNext = this.handleNext.bind(this)
  }
  componentDidMount () {
    this.maybeScrollToActive()
  }
  componentDidUpdate (prevProps) {
    const { index } = this.props

    if (prevProps.index !== index) {
      this.maybeScrollToActive()
    }
  }
  handlePrevious () {
    const { index, onChange } = this.props

    if (index > 0) {
      onChange(index - 1)
    }
  }
  handleNext () {
    const {
      index, collection, onChange,
    } = this.props

    if (index < collection.length - 1) {
      onChange(index + 1)
    }
  }
  maybeScrollToActive () {
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
      index, collection, onChange, showPagesCount, showActions, showPreviews, slotSlide,
    } = this.props

    return (
      <div ref={(ref) => { this.container = ref }} className={css.root}>
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
                    >
                      <div className={css.number}>{item.page}</div>
                      <div className={css.image}>
                        <VisibilitySensor partialVisibility>
                          {({ isVisible }) => isVisible && item.preview
                            ? <img src={item.preview} />
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
            {({ size }) => {
              let result

              if (collection[index].image) {
                const imageSize = calculateSize(
                  size.width,
                  size.height,
                  collection[index].imageWidth,
                  collection[index].imageHeight
                )

                result = (
                  <div className={css.slide}>
                    <img
                      className={css.mainImage}
                      src={collection[index].image}
                      width={imageSize.width}
                      height={imageSize.height}
                    />
                    {
                      slotSlide && (
                        <div className={css.slotSlide}>
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
            (showPagesCount || (showActions && onChange)) && (
              <div className={css.controls}>
                {
                  showActions && onChange && (
                    <div>
                      <button
                        type='button'
                        className={css.linkArrow}
                        onClick={this.handlePrevious}
                        disabled={index === 0}
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

export { Presentation }