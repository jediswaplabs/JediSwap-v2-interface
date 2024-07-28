import { BrowserEvent, InterfaceElementName, InterfaceEventName } from '@uniswap/analytics-events'
import { useAccountDetails } from 'hooks/starknet-react'
import { TraceEvent } from 'analytics'
import { useToggleAccountDrawer } from 'components/AccountDrawer'
import Loader from 'components/Icons/LoadingSpinner'
import { ActivationStatus, useActivationState } from 'connection/activate'
import { Connection } from 'connection/types'
import { useConnectors } from 'hooks/starknet-react'
import styled from 'styled-components'
// import { useIsDarkMode } from 'theme/components/ThemeToggle'
import { flexColumnNoWrap, flexRowNoWrap } from 'theme/styles'
import { connect, Connector } from 'starknetkit'

const OptionCardLeft = styled.div`
  ${flexColumnNoWrap};
  flex-direction: row;
  align-items: center;
`

const OptionCardClickable = styled.button<{ selected: boolean }>`
  align-items: center;
  background-color: unset;
  border: none;
  cursor: pointer;
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  justify-content: space-between;
  opacity: ${({ disabled, selected }) => (disabled && !selected ? '0.5' : '1')};
  padding: 18px;
  transition: ${({ theme }) => theme.transition.duration.fast};
`

const HeaderText = styled.div`
  ${flexRowNoWrap};
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.color === 'blue' ? ({ theme }) => theme.accent1 : ({ theme }) => theme.neutral1)};
  font-size: 16px;
  font-weight: 535;
  padding: 0 8px;
`
const IconWrapper = styled.div`
  ${flexColumnNoWrap};
  align-items: center;
  justify-content: center;
  img {
    ${({ theme }) => !theme.darkMode && `border: 1px solid ${theme.surface3}`};
    border-radius: 12px;
  }
  & > img,
  span {
    height: 40px;
    width: 40px;
  }
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToMedium`
    align-items: flex-end;
  `};
`

const Wrapper = styled.div<{ disabled: boolean }>`
  align-items: stretch;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  position: relative;
  width: 100%;

  background-color: ${({ theme }) => theme.surface2};

  &:hover {
    cursor: ${({ disabled }) => !disabled && 'pointer'};
    background-color: ${({ theme, disabled }) => !disabled && theme.surface3};
  }
  &:focus {
    background-color: ${({ theme, disabled }) => !disabled && theme.surface3};
  }
`

interface OptionProps {
  connector: Connector
}
