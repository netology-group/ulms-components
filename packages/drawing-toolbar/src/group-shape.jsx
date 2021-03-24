/* eslint-disable jsx-a11y/click-events-have-key-events */
// TODO: rewrite with useCallback
import React from 'react'
import cn from 'classnames-es'
import Floater from 'react-floater'
import { shapeToolModeEnum, toolEnum } from '@ulms/ui-drawing/src/constants'

import { toCSSColor } from './utils'
import { Shapes } from './shapes'

const shapeToolModeList = [
  {
    icon: 'square',
    mode: shapeToolModeEnum.RECT,
    solid: false,
  },
  {
    icon: 'square',
    mode: shapeToolModeEnum.RECT_SOLID,
    solid: true,
  },
  {
    icon: 'circle',
    mode: shapeToolModeEnum.CIRCLE,
    solid: false,
  },
  {
    icon: 'circle',
    mode: shapeToolModeEnum.CIRCLE_SOLID,
    solid: true,
  },
  {
    icon: 'triangle',
    mode: shapeToolModeEnum.TRIANGLE,
    solid: false,
  },
  {
    icon: 'triangle',
    mode: shapeToolModeEnum.TRIANGLE_SOLID,
    solid: true,
  },
]

export const GroupShape = ({
  brushColor,
  css,
  handleChange,
  opened,
  shapeMode,
  tool,
}) => (
  <Floater
    component={() => (
      <div
        className={cn(css.popover, css.floater)}
        style={{ color: toCSSColor(brushColor) }}
      >
        <div className={css.row}>
          {
            shapeToolModeList.map(({
              icon, mode, solid,
            }) => (
              <div
                className={cn(css.button, {
                  [css.active]: shapeMode === mode && tool === toolEnum.SHAPE,
                })}
                key={`${mode}-${solid}`}
                onClick={() => handleChange({ shapeMode: mode, tool: toolEnum.SHAPE })}
                role='button'
                tabIndex='0'
              >
                <Shapes shape={icon} solid={solid} />
              </div>
            ))
          }
        </div>
      </div>
    )}
    placement='right-start'
    hideArrow
    styles={{
      floater: {
        filter: 'none',
      },
    }}
    open={opened === 'group-shape'}
    target={`.${css.root} .group-shape`}
  />
)
