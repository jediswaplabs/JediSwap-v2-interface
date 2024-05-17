import { Trans } from '@lingui/macro'
import { useAccountDetails } from 'hooks/starknet-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

import PortfolioDrawer, { useAccountDrawer } from 'components/AccountDrawer'
import { usePendingActivity } from 'components/AccountDrawer/MiniPortfolio/Activity/hooks'
import Loader from 'components/Icons/LoadingSpinner'
import StatusIcon, { IconWrapper } from 'components/Identicon/StatusIcon'
import PrefetchBalancesWrapper from 'components/PrefetchBalancesWrapper/PrefetchBalancesWrapper'
import { getConnection } from 'connection'
import { useConnectionReady } from 'connection/eagerlyConnect'
import useENSName from 'hooks/useENSName'
import useLast from 'hooks/useLast'
import { Portal } from 'nft/components/common/Portal'
import { useAppSelector } from 'state/hooks'
import { flexRowNoWrap } from 'theme/styles'
import { shortenAddress } from 'utils'
import { BaseButton, ButtonPrimary, ButtonSecondary, ButtonSize, ThemeButton } from '../Button'
import { RowBetween } from '../Row'
import { useConnect, useDisconnect, useStarkProfile } from '@starknet-react/core'
import { ChainId } from '@vnaysn/jediswap-sdk-core'
import StarknetIcon from 'assets/svg/starknet.svg'
import { Connector, useStarknetkitConnectModal } from 'starknetkit'
import { useAvailableConnectors } from 'context/StarknetProvider'

const FULL_BORDER_RADIUS = 9999

const Web3StatusGeneric = styled(ButtonSecondary)`
  ${flexRowNoWrap};
  width: 100%;
  align-items: center;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  height: 38px;
  font-size: 16px;
  font-weight: 600;
`

const Web3StatusConnectWrapper = styled.div`
  font-family: 'Avenir LT Std';
  background-color: ${({ theme }) => theme.surface5};
  border: none;
  color: ${({ theme }) => theme.white};
`

const Web3StatusConnected = styled(Web3StatusGeneric)<{
  pending?: boolean
  isClaimAvailable?: boolean
}>`
  font-family: 'Avenir LT Std';
  background-color: ${({ theme }) => theme.surface5};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.white};
  padding: 10px 24px;
`

const NetworkContainer = styled.div`
  ${flexRowNoWrap};
  width: 100%;
  align-items: center;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  height: 38px;
  font-size: 16px;
  font-weight: 600;
  font-family: 'Avenir LT Std';
  border: none;
  color: ${({ theme }) => theme.white};
  margin-right: 16px;
  padding: 10px 24px;
`

const NetworkSelected = styled(Web3StatusGeneric)<{}>`
  font-family: 'Avenir LT Std';
  background-color: ${({ theme }) => theme.jediNavyBlue};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.white};
  margin-right: 16px;
  padding: 10px 24px;
`

const AddressAndChevronContainer = styled.div<{ loading?: boolean }>`
  display: flex;
  align-items: center;
  opacity: ${({ loading, theme }) => loading && theme.opacity.disabled};
`

const Text = styled.p`
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  font-size: 16px;
  width: fit-content;
  font-weight: 600;
`

const StyledConnectButton = styled.button`
  background-color: transparent;
  border: none;
  border-top-left-radius: ${FULL_BORDER_RADIUS}px;
  border-bottom-left-radius: ${FULL_BORDER_RADIUS}px;
  cursor: pointer;
  font-weight: 535;
  font-size: 16px;
  padding: 10px 12px;
  color: inherit;
`

function Web3StatusInner() {
  const [, toggleAccountDrawer] = useAccountDrawer()
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isWrongNetwork, setIsWrongNetwork] = useState(false)
  const [showWallet, setShowWallet] = useState<boolean>(false)
  const { address, connector, chainId } = useAccountDetails()
  const { connectAsync } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    address ? setIsConnected(true) : setIsConnected(false)
  }, [address])

  const connectors = useAvailableConnectors()
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors,
  })
  const connectWallet = async () => {
    const { connector } = await starknetkitConnectModal()
    if (!connector) {
      return
    }
    await connectAsync({ connector })
  }

  const handleWalletDropdownClick = useCallback(() => {
    // toggleAccountDrawer()
    if (!isConnected) {
      connectWallet()
    } else {
      toggleAccountDrawer()
    }
  }, [toggleAccountDrawer, isConnected])
  const { data: starkName } = useStarkProfile({ address })

  if (address) {
    return (
      <NetworkContainer>
        <NetworkSelected data-testid="web3-status-connected" onClick={handleWalletDropdownClick}>
          <IconWrapper size={20}>
            <img src={StarknetIcon} alt="Starknet" />
          </IconWrapper>
          <Text>{chainId === ChainId.MAINNET ? 'Mainnet' : 'Sepolia'}</Text>
        </NetworkSelected>
        <Web3StatusConnected data-testid="web3-status-connected" onClick={handleWalletDropdownClick}>
          <StatusIcon account={address} connection={connector} size={40} />
          <AddressAndChevronContainer>
            <Text>{starkName?.name ?? shortenAddress(address)}</Text>
          </AddressAndChevronContainer>
        </Web3StatusConnected>
      </NetworkContainer>
    )
  } else {
    return (
      <Web3StatusConnectWrapper tabIndex={0} onClick={handleWalletDropdownClick}>
        <ButtonPrimary tabIndex={-1} data-testid="navbar-connect-wallet" style={{padding: "10px 25px"}}>
          <Trans>Connect wallet</Trans>
        </ButtonPrimary>
      </Web3StatusConnectWrapper>
    )
  }
}

export default function Web3Status() {
  const [isDrawerOpen] = useAccountDrawer()
  return (
    <PrefetchBalancesWrapper shouldFetchOnAccountUpdate={isDrawerOpen}>
      <Web3StatusInner />
      <Portal>
        <PortfolioDrawer />
      </Portal>
    </PrefetchBalancesWrapper>
  )
}
