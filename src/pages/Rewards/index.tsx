import React, { MouseEvent, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BodyWrapper } from '../AppBody'
import styled, { ThemeContext, css, keyframes } from 'styled-components'
import { AutoColumn } from 'components/Column'
import StarkIcon from 'assets/svg/starknet.svg'
import CoinsIcon from 'assets/svg/coins.svg'
import StarsIcon from 'assets/svg/stars.svg'
import ArrowRight from 'assets/svg/arrow_right.svg'
import WalletIcon from 'assets/wallets/Wallet.png'
import { MouseoverTooltip, TooltipSize } from 'components/Tooltip'
import './style.css'
import { CurrencyAmount, Token } from '@jediswap/sdk'
import { ButtonPrimary, ButtonSecondary } from 'components/Button'
import { RowBetween, RowFixed } from 'components/Row'
import { Button as RebassButton, ButtonProps } from 'rebass/styled-components'
import { useContractRead, useContractWrite } from '@starknet-react/core'
import { BlockTag, Call, CallData, validateAndParseAddress } from 'starknet'
import { DEFAULT_CHAIN_ID, STARKNET_REWARDS_API_URL, STRK_PRICE_API_URL, getStarkRewardAddress } from 'constants/tokens'
import REWARDS_ABI from 'abis/strk-rewards.json'
import { jediSwapClient } from 'apollo/client'
import { HISTORICAL_POOLS_DATA, STRK_REWARDS_DATA } from 'apollo/queries'
import { isEmpty } from 'lodash'
import DoubleCurrencyLogo from 'components/DoubleLogo'
import { useDefaultActiveTokens } from 'hooks/Tokens'
import { useAccountDetails } from 'hooks/starknet-react'
import { CardSection, DataCard } from 'components/earn/styled'
import { colors } from 'theme/colors'
import TransactionConfirmationModal, { TransactionErrorContent } from 'components/TransactionConfirmationModal'
import { useToggleAccountDrawer } from 'components/AccountDrawer'
import { findClosestAPRPeriod } from 'utils/getClosest'
import { formattedPercent } from 'utils/formattedPercent'
import { apiTimeframeOptions } from 'constants/apiTimeframeOptions'
import { ApolloQueryResult } from '@apollo/client'
import { ChainId } from '@vnaysn/jediswap-sdk-core'

const PageWrapper = styled(AutoColumn)`
  max-width: 996px;
  width: 100%;
`

const LiquidityWrapperCard = styled(DataCard)`
  overflow: hidden;
  border: none;
  border-radius: 8px;
  // padding: 18px;
  border: 1px solid rgba(160, 160, 160, 0.4);
  background: rgba(255, 255, 255, 0.05);
`

export const BaseButton = styled(RebassButton)<
  {
    padding?: string
    width?: string
    $borderRadius?: string
    altDisabledStyle?: boolean
  } & ButtonProps
>`
  padding: ${({ padding }) => padding ?? '16px'};
  width: ${({ width }) => width ?? '100%'};
  font-weight: 500;
  text-align: center;
  border-radius: ${({ $borderRadius }) => $borderRadius ?? '20px'};
  outline: none;
  border: 1px solid transparent;
  color: white;
  text-decoration: none;
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  align-items: center;
  cursor: pointer;
  position: relative;
  z-index: 1;
  &:disabled {
    cursor: auto;
    pointer-events: none;
  }

  will-change: transform;
  transition: transform 450ms ease;
  transform: perspective(1px) translateZ(0);

  > * {
    user-select: none;
  }

  > a {
    text-decoration: none;
  }
`

const ClaimHeader = styled.div`
  // width: 386px;
  height: 52px;
  flex-shrink: 0;
  margin-top: 18px;
  padding: 0 32px;
  background: linear-gradient(93deg, rgba(252, 142, 81, 0.3) 1.17%, rgba(235, 0, 255, 0) 86.07%);
  color: white; /* White text color */
  display: flex;
  align-items: center; /* Vertically centers the content */

  @media (max-width: 768px) {
    width: fit-content;
  }
`

const ClaimHeaderText = styled.div`
  opacity: 1;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 20px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 100% */
`

export const WrapperOutlined = styled(BaseButton)`
  border: 1px solid ${({ theme }) => colors.surface2_dark};
  background-color: transparent;
  color: ${({ theme }) => theme.white};
  &:focus {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  &:hover {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  &:active {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
`

const AmountText = styled.div`
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 32px;
  font-style: normal;
  font-weight: 700;
  line-height: 20px; /* 62.5% */
`

const IncentivesText = styled.div`
  color: #f2f2f2;
  font-family: 'DM Sans';
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 26px; /* 162.5% */
  margin-bottom: 20px;
`

const HeaderText = styled.div`
  align-items: center;
  display: flex;
  margin-bottom: 22px;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    font-size: 20px;
  }
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 125% */
`

const ResponsiveColumn = styled(AutoColumn)`
  padding: 16px;
  border-radius: 20px;
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  border: 1px solid rgba(160, 160, 160, 0.4);
  background: rgba(255, 255, 255, 0.05);
  color: ${({ theme }) => theme.white};
  &:focus {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  &:hover {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  &:active {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  grid-template-columns: 1fr;
  width: 100%;
  justify-content: space-between;
`

const DefiSpringWrapper = styled.div`
  border-radius: 20px;
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  color: ${({ theme }) => theme.white};
  grid-template-columns: 1fr;
  width: 100%;
  justify-content: space-between;
`
const DefiSpringLink = styled.a`
  color: ${({ theme }) => theme.jediBlue};
  text-decoration: none;
  font-weight: 700;
`

const DefiSpringTitle = styled.div`
  color: #fff;
  font-family: 'DM Sans';
  font-size: 20px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 100% */
  margin-bottom: 32px;
`

const DefiSpringTitleEarn = styled(DefiSpringTitle)`
  margin-bottom: 12px;
  @media (max-width: 992px) {
    font-size: 16px;
  }
`

const DefiSpringSubTitle = styled.div`
  display: flex; /* Establishes a flex container */
  align-items: center; /* Centers the content vertically */

  /* Style for the image, if necessary */
  img {
    margin: 0 10px; /* Adjust spacing between text and image as needed */
    height: 40px; /* Fixed height for consistency */
    width: 40px; /* Fixed width for consistency */
  }

  color: #fff;
  font-feature-settings: 'clig' off, 'liga' off;
  font-family: 'DM Sans';
  font-size: 32px;
  font-style: normal;
  font-weight: 700;
  line-height: 20px; /* 62.5% */
`

const ClaimWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`

const ClaimButtonGradient = styled(ButtonPrimary)`
  display: flex;
  // width: auto;
  width: 160px;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--Jedi-Gradient, linear-gradient(96deg, #29aafd 8.08%, #ff00e9 105.91%));
`

const ClaimText = styled.div`
  color: #fff;
  text-align: center;
  font-family: 'Avenir LT Std', sans-serif;
  font-size: 18px;
  font-style: normal;
  font-weight: 750;
`

const StarkRewardsText = styled.div`
  color: #fff;
  font-family: 'DM Sans';
  font-size: 20px;
  margin-bottom: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: 20px; /* 100% */
`

const PairName = styled.div`
  color: var(--Jedi-White, #fff);
  text-align: center;
  font-family: 'DM Sans';
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: 100%; /* 16px */
  margin: 10px 0;
`
const APRWrapper = styled.div`
  display: flex;
  justify-content: space-between;
`

const TotalAPR = styled(APRWrapper)`
  width: 100%;
  background: #6a2d65;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid rgba(160, 160, 160, 0.4);
  color: #f2f2f2;
  leading-trim: both;
  text-edge: cap;
  font-family: 'DM Sans';
  padding: 0 8px;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  line-height: 18px; /* 216.667% */
`

const TokenAPR = styled(APRWrapper)`
  color: #f2f2f2;
  font-family: 'DM Sans';
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 26px; /* 216.667% */
`

export const loadingAnimation = keyframes`
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`

const shimmerMixin = css`
  animation: ${loadingAnimation} 1.5s infinite;
  animation-fill-mode: both;
  background: linear-gradient(
    to left,
    ${({ theme }) => theme.jediNavyBlue} 25%,
    ${({ theme }) => colors.surface3_dark} 50%,
    ${({ theme }) => theme.jediNavyBlue} 75%
  );
  background-size: 400%;
  will-change: background-position;
`

export const LoadingRows = styled.div`
  display: grid;

  & > div {
    ${shimmerMixin}
    border-radius: 12px;
    height: 2.4em;
  }
`

const Container = styled.div`
  display: flex;
  justify-content: center;
`

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px; /* Gap between columns */
  width: 100%;
`

const RowWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px; /* Gap between columns */
  width: 100%;
`

const Column = styled.div`
  flex: 1;
  padding: 16px;
  border-radius: 20px;
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  border: 1px solid rgba(160, 160, 160, 0.4);
  background: rgba(255, 255, 255, 0.05);
  color: ${({ theme }) => theme.white};
  &:focus {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  &:hover {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }
  &:active {
    box-shadow: 0 0 0 1px ${({ theme }) => '#565a69'};
  }

  @media (max-width: 768px) {
    width: calc(50% - 10px);
    flex: auto;
  }

  @media (max-width: 400px) {
    width: calc(100% - 10px);
  }
`

// Styled component for the second column (60%)
const SecondColumn = styled.div`
  width: 70%;
  display: flex;
  flex-wrap: wrap;
  @media (max-width: 992px) {
    width: 100%;
  }
`

// Main container for the row
const RowContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`

// Styled component for the first column (40%)
const FirstColumn = styled.div`
  width: 30%;
  padding: 0 15px; // For spacing
  @media (max-width: 992px) {
    width: 100%;
    padding: 0; // For spacing
  }
`

// Styled component for the second column (60%)
const MobileWrapper = styled.div`
  width: 100%;
  @media (max-width: 768px) {
    padding: 0px;
  }
`
const ConnectWalletText = styled.div`
  font-size: 20px;
  font-weight: 600;
  font-family: 'Avenir LT Std', sans-serif;
  max-width: 410px;
  text-align: center;
`
const ConnectWalletWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`
const Coins = styled.div`
  position: absolute;
  top: 32px;
  right: 32px;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    display: none;
  }
`

const WalletNotConnected = () => {
  const toggleWalletDrawer = useToggleAccountDrawer()
  return (
    <ConnectWalletWrapper>
      <img src={WalletIcon} />
      <ConnectWalletText>Connect wallet to see your STRK rewards</ConnectWalletText>
      <ClaimButtonGradient
        onClick={toggleWalletDrawer}
        style={{ marginTop: '20px', padding: '10px 36px', width: 'auto' }}
      >
        <ClaimText>Connect Wallet</ClaimText>
      </ClaimButtonGradient>
    </ConnectWalletWrapper>
  )
}

const ConnectedToSepolia = () => {
  return (
    <ConnectWalletWrapper>
      <img src={WalletIcon} />
      <ConnectWalletText>Switch your network from Sepolia to Mainnet to see rewards</ConnectWalletText>
    </ConnectWalletWrapper>
  )
}

const AllocationError = () => {
  return (
    <ConnectWalletWrapper>
      <ConnectWalletText>
        An error occurred while checking your allocation. Don't worry; it is OK. Please try again later.
      </ConnectWalletText>
    </ConnectWalletWrapper>
  )
}

function getRewardsData(jediRewards: any, pool: any) {
  if (!jediRewards) {
    return
  }
  const pair1 = `${pool?.pool?.token0.symbol}/${pool?.pool?.token1.symbol}`.toLowerCase()
  const pair2 = `${pool?.pool?.token1.symbol}/${pool?.pool?.token0.symbol}`.toLowerCase()
  const pairKey = Object.keys(jediRewards).find((key) => key.toLowerCase() === pair1 || key.toLowerCase() === pair2)
  if (pairKey && jediRewards[pairKey]) {
    return jediRewards[pairKey]
  }
}

export default function Rewards() {
  const [allPools, setAllPools] = useState<any[]>([])
  const { address: rawAddress, chainId } = useAccountDetails()
  const address = rawAddress?.replace(/^0x0*/, '0x')
  const [poolsLoading, setPoolsLoading] = useState(true)
  const STRK_REWARDS_ADDRESS = getStarkRewardAddress(chainId ?? DEFAULT_CHAIN_ID)
  const allTokens = useDefaultActiveTokens(DEFAULT_CHAIN_ID)
  const isSepoliaSelected = chainId === ChainId.GOERLI
  const isMainnetSelected = chainId === ChainId.MAINNET

  useEffect(() => {
    async function getPairsData() {
      // setPoolsLoading(true)
      const requests = [
        jediSwapClient.query({
          query: HISTORICAL_POOLS_DATA({
            tokenIds: [],
            periods: [apiTimeframeOptions.oneDay, apiTimeframeOptions.twoDays, apiTimeframeOptions.oneWeek],
          }),
          fetchPolicy: 'cache-first',
        }),
        jediSwapClient.query({
          query: STRK_REWARDS_DATA(),
          fetchPolicy: 'cache-first',
        }),
      ]
      const [poolsDataRawResult, rewardsRespResult] = await Promise.allSettled(requests)
      let pools: any = null
      if (poolsDataRawResult.status === 'fulfilled') {
        pools = poolsDataRawResult.value as ApolloQueryResult<any>
      }
      let jediRewards: any = null
      if (rewardsRespResult.status === 'fulfilled') {
        const rewardsResp = rewardsRespResult.value as ApolloQueryResult<any>
        jediRewards = rewardsResp.data?.strkGrantDataV2
      }

      const eligiblePools = []
      try {
        for (const pool of pools?.data?.poolsData) {
          const tokenSymbols = [pool?.pool?.token0.symbol, pool?.pool?.token1.symbol].sort()
          const pair = tokenSymbols.join('/')
          const rewardsData = getRewardsData(jediRewards, pool)
          if (rewardsData) {
            const aprStarknet = rewardsData.apr * 100
            // const closestAPRPeriod = findClosestAPRPeriod(pool?.period)
            const closestAPRPeriod = pool?.period?.[apiTimeframeOptions.oneDay]
            const feeRatio24H =
              closestAPRPeriod?.feesUSD && closestAPRPeriod?.totalValueLockedUSD
                ? parseFloat(closestAPRPeriod.feesUSD) / parseFloat(closestAPRPeriod?.totalValueLockedUSD)
                : 0
            const aprFee = feeRatio24H * 365 * 100

            const cleanedAprFee = isNaN(aprFee) || !isFinite(aprFee) ? 0 : aprFee
            const displayAprFee = formattedPercent(cleanedAprFee, true, false)

            const cleanedAprStarknet = isNaN(aprStarknet) || !isFinite(aprStarknet) ? 0 : aprStarknet
            const displayAprStarknet = formattedPercent(cleanedAprStarknet, true, false)

            const cleanedAprCommon = cleanedAprFee + cleanedAprStarknet
            const displayAprCommon = formattedPercent(cleanedAprCommon, true, false)

            const rewardsPool = {
              ...pool.pool,
              pair,
              aprStarknet,
              aprFee,
              cleanedAprCommon,
              displayAprFee,
              displayAprStarknet,
              displayAprCommon,
              period: closestAPRPeriod,
            }
            eligiblePools.push(rewardsPool)
          }
        }
      } catch (e) {
        console.log(e)
      }

      // Function to filter unique pairs with highest totalValueLockedUSD value
      const filterUniquePairs = (data: any) => {
        const pairsMap = new Map()
        data.forEach((obj: any) => {
          const pair = obj.pair
          // const cleanedAprCommon = obj.cleanedAprCommon
          const totalValueLockedUSD = parseFloat(obj.totalValueLockedUSD)

          if (!pairsMap.has(pair) || parseFloat(pairsMap.get(pair).totalValueLockedUSD) < totalValueLockedUSD) {
            pairsMap.set(pair, obj)
          }
        })

        return Array.from(pairsMap.values())
      }
      const uniquePools = filterUniquePairs(eligiblePools)

      setAllPools(uniquePools)
      setPoolsLoading(false)
    }

    if (!allPools.length) {
      getPairsData()
    }
  }, [])

  const [allocations, setAllocations] = useState<CurrencyAmount>()
  const [allocationsLoading, setAllocationsLoading] = useState(false)
  const [allocationsLoadingError, setAllocationsLoadingError] = useState(false)
  const [claimData, setClaimData] = useState({})
  const [allocated, setAllocated] = useState(false)
  const [callData, setCallData] = useState<Call[]>([])
  const { writeAsync, data: txData } = useContractWrite({
    calls: callData,
  })
  const [txHash, setTxHash] = useState('')
  const [claimError, setClaimError] = useState('')
  const [txPending, setTxPending] = useState(false)
  const [attemptingTxn, setAttemptingTxn] = useState(false)

  //fetch allocation data
  useEffect(() => {
    const getAllocation = async () => {
      if (address && isMainnetSelected) {
        try {
          setAllocationsLoading(true)
          const requests = [
            fetch(`https://allocations.jediswap.xyz/get_allocation_amount?address=${address}`, {
              headers: {
                accept: 'application/json',
              },
              method: 'GET',
            }).then((res) => res.json()),
            fetch(`https://allocations.jediswap.xyz/get_calldata?address=${address}`, {
              headers: {
                accept: 'application/json',
              },
              method: 'GET',
            }).then((res) => res.json()),
          ]
          const [allocation, call_data] = await Promise.all(requests)
          const totalAllocation = CurrencyAmount.ether(allocation)
          setAllocations(totalAllocation)
          const isAllocatedMoreThanZero = !totalAllocation.equalTo('0')
          setAllocated(isAllocatedMoreThanZero)
          setClaimData(call_data)
          setAllocationsLoading(false)
          setAllocationsLoadingError(false)
        } catch (e) {
          setAllocationsLoading(false)
          setAllocationsLoadingError(true)
          console.error('allocation_loading_error', e)
        }
      }
    }

    getAllocation()
  }, [address, chainId])

  useEffect(() => {
    if (callData.length && address) {
      writeAsync()
        .then((res) => {
          if (res && res.transaction_hash) {
            setTxHash(res.transaction_hash)
          }
        })
        .catch((error) => {
          const errorMessage = new Error(error)
          setClaimError(errorMessage.message)
        })
        .finally(() => {
          setAttemptingTxn(false)
          setCallData([])
        })
    }
  }, [callData, address])

  const onClaim = () => {
    setAttemptingTxn(true)
    setTxPending(true)

    const call = {
      contractAddress: STRK_REWARDS_ADDRESS,
      entrypoint: 'claim',
      calldata: CallData.compile(claimData),
    }
    setCallData([call])
  }

  const { data: claimed_rewards } = useContractRead({
    functionName: 'amount_already_claimed',
    args: [address as any],
    abi: REWARDS_ABI,
    address: STRK_REWARDS_ADDRESS,
    watch: true,
    blockIdentifier: BlockTag.pending,
  })

  const formattedClaimRewards: CurrencyAmount = useMemo(() => {
    if (claimed_rewards === null || claimed_rewards === undefined) return CurrencyAmount.ether('0')
    return CurrencyAmount.ether(claimed_rewards.toString())
  }, [claimed_rewards, address, allocations])

  const unclaimed_rewards: CurrencyAmount = useMemo(() => {
    if (formattedClaimRewards === null || formattedClaimRewards === undefined || !allocated || !allocations)
      return CurrencyAmount.ether('0')
    return allocations?.subtract(formattedClaimRewards)
  }, [formattedClaimRewards, claimed_rewards, address, allocations, allocated])

  const totalRewardsClaimed = allocations?.equalTo(formattedClaimRewards)

  const handleConfirmDismiss = () => {
    setAttemptingTxn(false)
    setTxPending(false)
    setCallData([])
  }

  const confirmationContent = useCallback(
    () => (claimError ? <TransactionErrorContent onDismiss={handleConfirmDismiss} message={claimError} /> : <></>),
    [claimError]
  )
  const buttonText =
    (totalRewardsClaimed && 'Claimed') || (unclaimed_rewards && 'Claim STRK') || (attemptingTxn && 'Claiming...')

  const onLinkClick = (e: MouseEvent) => {
    if (isSepoliaSelected) {
      e.preventDefault()
    }
  }
  const PairListItem = ({ pool }: { pool: any }) => {
    const token0 =
      pool.token0.symbol === 'ETH' ? pool.token0 : allTokens[validateAndParseAddress(pool.token0.tokenAddress)]
    const token1 =
      pool.token1.symbol === 'ETH' ? pool.token1 : allTokens[validateAndParseAddress(pool.token1.tokenAddress)]
    const token0ForLink = pool.token0.symbol === 'ETH' ? 'ETH' : pool.token0.tokenAddress
    const token1ForLink = pool.token1.symbol === 'ETH' ? 'ETH' : pool.token1.tokenAddress
    const link = `/add/${token0ForLink}/${token1ForLink}/${pool.fee}`
    return (
      <Column style={{ padding: 10, flexBasis: '32%', flexGrow: 0 }}>
        <Link
          to={link}
          onClick={onLinkClick}
          style={{ textDecoration: 'none', cursor: isSepoliaSelected ? 'auto' : 'pointer' }}
        >
          <MouseoverTooltip
            disabled={!isSepoliaSelected}
            text="Switch to Mainnet to add liquidity"
            style={{ display: 'block' }}
            placement="bottom"
            hideArrow
            offsetY={-20}
            size={TooltipSize.UltraSmall}
            borderRadius="8px"
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <DoubleCurrencyLogo size={24} currency0={token0} currency1={token1} />
            </div>
            <PairName>
              {pool?.token0?.symbol}-{pool?.token1?.symbol}
            </PairName>
            <TotalAPR>
              <div>Total APR:</div>
              <div>{pool.displayAprCommon}</div>
            </TotalAPR>
            <TokenAPR>
              <div>Fee APR:</div>
              <div>{pool.displayAprFee}</div>
            </TokenAPR>
            <TokenAPR>
              <div>STRK APR:</div>
              <div>{pool.displayAprStarknet}</div>
            </TokenAPR>
          </MouseoverTooltip>
        </Link>
      </Column>
    )
  }

  return (
    <PageWrapper>
      {!allocationsLoading && (
        <TransactionConfirmationModal
          isOpen={txPending}
          onDismiss={handleConfirmDismiss}
          attemptingTxn={attemptingTxn}
          hash={txHash}
          reviewContent={confirmationContent}
          pendingText={''}
        />
      )}
      {poolsLoading ? (
        <LoadingRows>
          <div style={{ height: 450 }} />
        </LoadingRows>
      ) : (
        <LiquidityWrapperCard style={{ marginBottom: '14px', padding: '18px' }}>
          <RowContainer>
            <FirstColumn>
              <DefiSpringWrapper>
                <DefiSpringTitle>StarkNet DeFi Spring</DefiSpringTitle>
                <DefiSpringSubTitle>
                  90M <img src={StarkIcon} alt="starknet_logo" /> STRK
                </DefiSpringSubTitle>
                <IncentivesText>
                  JediSwap users will receive STRK incentives as part of the StarkNet DeFi Spring Program.
                </IncentivesText>
              </DefiSpringWrapper>
              <DefiSpringLink href="https://docs.jediswap.xyz/defi-spring-strk-incentives-for-v2" target="_blank">
                See How we are calculating it <img src={ArrowRight} />
              </DefiSpringLink>
            </FirstColumn>
            <SecondColumn>
              <MobileWrapper>
                <DefiSpringWrapper>
                  <DefiSpringTitleEarn>Earn STRK incentives by providing liquidity to these pools:</DefiSpringTitleEarn>
                </DefiSpringWrapper>
                <Container>
                  <RowWrapper>
                    {allPools.map((pool) => (
                      <PairListItem key={pool.poolAddress} pool={pool} />
                    ))}
                  </RowWrapper>
                </Container>
              </MobileWrapper>
            </SecondColumn>
          </RowContainer>
        </LiquidityWrapperCard>
      )}
      {allocationsLoading ? (
        <LoadingRows>
          <div style={{ height: 450 }} />
        </LoadingRows>
      ) : (
        <LiquidityWrapperCard style={{ position: 'relative' }}>
          {/* <Coins>
            <img src={CoinsIcon}/>
          </Coins> */}
          <RowBetween>
            <ClaimHeader>
              <ClaimHeaderText>Next claim available on August 16</ClaimHeaderText>
              <img src={StarsIcon} style={{ marginLeft: '20px', marginBottom: '15px' }} />
            </ClaimHeader>
          </RowBetween>
          <CardSection style={{ padding: isMainnetSelected ? '32px' : '0 32px 32px 32px' }}>
            {!chainId ? (
              <WalletNotConnected />
            ) : isSepoliaSelected ? (
              <ConnectedToSepolia />
            ) : allocationsLoadingError ? (
              <AllocationError />
            ) : (
              <>
                <AutoColumn>
                  <Coins>
                    <img src={CoinsIcon} />
                  </Coins>
                  <RowBetween>
                    <StarkRewardsText>Your STRK Rewards</StarkRewardsText>
                  </RowBetween>

                  <Container>
                    <Row>
                      <Column>
                        <HeaderText>
                          <>
                            <img src={StarkIcon} style={{ marginRight: 5 }} />
                            STRK ALLOCATED
                          </>
                        </HeaderText>
                        <AmountText>{allocations?.toSignificant() ?? 0}</AmountText>
                      </Column>
                      <Column>
                        <HeaderText>
                          <>
                            <img src={StarkIcon} style={{ marginRight: 5 }} />
                            STRK CLAIMED
                          </>
                        </HeaderText>
                        <AmountText>{formattedClaimRewards?.toSignificant() ?? 0}</AmountText>
                      </Column>
                      <Column>
                        <HeaderText>
                          <>
                            <img src={StarkIcon} style={{ marginRight: 5 }} />
                            STRK UNCLAIMED
                          </>
                        </HeaderText>
                        <ClaimWrapper>
                          <AmountText>{unclaimed_rewards.toSignificant(5) ?? 0}</AmountText>

                          {allocated && allocations && (totalRewardsClaimed || unclaimed_rewards || attemptingTxn) ? (
                            <ClaimButtonGradient onClick={onClaim} disabled={attemptingTxn || totalRewardsClaimed}>
                              <ClaimText>{buttonText}</ClaimText>
                            </ClaimButtonGradient>
                          ) : null}
                        </ClaimWrapper>
                      </Column>
                    </Row>
                  </Container>
                </AutoColumn>
                {/* <div style={{ marginTop: '20px', fontSize: '20px' }}>
                  NOTE: Jediswap v2 LPs are accumulating STRK rewards already. Claim for v2 rewards will go live soon.
                </div> */}
              </>
            )}
          </CardSection>
        </LiquidityWrapperCard>
      )}
    </PageWrapper>
  )
}
