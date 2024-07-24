import { Trans } from '@lingui/macro'
import Switch from 'react-switch'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'react-feather'
import { useMedia } from 'react-use'
import styled, { css } from 'styled-components'
import { Flex } from 'rebass'
import { Token } from '@vnaysn/jediswap-sdk-core'
import { isEmpty, pickBy } from 'lodash'
import { Link } from 'react-router-dom'
import { useBalance } from '@starknet-react/core'

import { useAccountDetails } from 'hooks/starknet-react'
import { AutoColumn } from 'components/Column'
import { ThemedText } from 'theme/components'
import DoubleCurrencyLogo from '../../components/DoubleLogo'
import JediSwapLoader from '../../components/Loader/JediSwapLoader'
import vaultImage from '../../assets/images/vault.png'
import noPositionsBg from '../../assets/svg/no-positions-bg.svg'
import { useFormatter } from '../../utils/formatNumbers'
import { formatUsdPrice } from '../../nft/utils'
import { useAllVaults } from 'state/vaults/hooks'
import { useUserShares } from 'components/vault/hooks'
import { useQuery } from 'react-query'
import { getClient } from 'apollo/client'
import { TOKENS_DATA } from 'apollo/queries'
import { validateAndParseAddress } from 'starknet'
import { findClosestPrice } from 'utils/getClosest'
import FeeBadge from 'components/FeeBadge'
import { DEFAULT_CHAIN_ID } from 'constants/tokens'

interface UserBalanceResultParams {
  vaultAddress: string
  balance: number
}

// Define the interface for custom props
interface ThemedTextProps {
  area?: string
  fontWeight?: number
}

// Extend the styled component with custom props
const ThemedTextBodySmall = styled(ThemedText.BodySmall)<ThemedTextProps>`
  // Your styles here
`

const PageWrapper = styled(AutoColumn)`
  padding: 0px 8px 0px;
  max-width: 920px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    padding-top: 20px;
    gap: 8px;
  }
`

const VaultLink = styled(Link)`
  align-items: center;
  display: flex;
  cursor: pointer;
  user-select: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: ${({ theme }) => theme.neutral1};
  text-decoration: none;
  font-weight: 535;
`

const ProviderLogo = styled.img`
  user-select: none;
  max-width: 100%;
`

const NoPositionsContainer = styled.div`
  background: url(${noPositionsBg}) no-repeat;
  background-color: #141451;
  background-position: center 20px;
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: auto;
  min-height: 100px;
  width: 100%;
  border-radius: 8px;
  padding: 2rem;
`

const ErrorContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: auto;
  min-height: 25vh;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    padding: 0px 52px;
  }
  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding: 0px 52px;
  }
`

const IconStyle = css`
  width: 48px;
  height: 48px;
  margin-bottom: 0.5rem;
`

const NetworkIcon = styled(AlertTriangle)`
  ${IconStyle}
`
interface PromotionBannerContainerProps {
  noDecorations?: boolean
}
const PromotionBannerContainer = styled.div<PromotionBannerContainerProps>`
  display: flex;
  border-radius: 8px;
  background: linear-gradient(90deg, #141451 0%, #2c045c 52%, #64099c 100%);
  position: relative;
  padding-left: ${(props) => (props.noDecorations ? '0' : '140px')};
  overflow: hidden;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    margin-bottom: 8px;
  }
`
const PromotionBannerDecoration = styled.img`
  position: absolute;
  left: -45px;
  top: -30px;
  max-width: 190px;
  user-select: none;
`

const PromotionBannerContent = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`
const PromotionBannerTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  line-height: 20px;
`
const PromotionBannerDescription = styled.div`
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-align: left;
`
const PromotionBannerLink = styled.a`
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  color: rgba(42, 170, 254, 1);
  text-decoration: none;
`

const PageTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const PageTitle = styled.div`
  font-family: Avenir LT Std;
  font-size: 24px;
  font-weight: 750;
  line-height: 24px;
  text-transform: uppercase;
`

const MyVaultsSwitcherContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const MyVaultsSwitcherLabel = styled.div`
  font-family: Avenir LT Std;
  font-size: 18px;
  font-weight: 750;
  line-height: 18px;
  text-align: left;
`

const MyVaultsSwitcher = styled(Switch)``

const DashGrid = styled.div`
  display: grid;
  grid-gap: 1em;
  grid-template-columns: 1.4fr 0.8fr 0.8fr 0.8fr 0.7fr;
  grid-template-areas: 'name provider tvl apr deposit';
  padding: 0 1.125rem;

  :hover {
    background: rgba(255, 255, 255, 0.1);
  }

  > * {
    justify-content: center;
    :first-child {
      justify-content: flex-start;
    }
  }

  @media screen and (max-width: 768px) {
    padding: 0 1.125rem;
    grid-template-columns: 1.4fr 0.8fr 0.8fr 0.7fr;
    grid-template-areas: 'name tvl apr deposit';
  }
`

const TableWrapper = styled.div`
  border-radius: 8px;
  overflow: hidden;
  box-shadow: rgba(227, 222, 255, 0.2) 0px 0.77px 30.791px 0px inset,
    rgba(154, 146, 210, 0.3) 0px 3.079px 13.856px 0px inset,
    rgba(202, 172, 255, 0.3) 0px 75.438px 76.977px -36.949px inset,
    rgba(96, 68, 144, 0.3) 0px -63.121px 52.345px -49.265px;
`

const Divider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
`

const List = styled.div``

const PageButtons = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 2em;
  margin-bottom: 0.5em;
`

const StyledTokenName = styled.span<{ active?: boolean }>`
  font-size: 14px;
  font-weight: 700;
  font-family: 'DM Sans';
  margin-left: 10px;
`

interface ArrowProps {
  faded?: boolean
}
const Arrow = styled.div<ArrowProps>`
  color: ${({ theme, faded }) => (faded ? theme.jediGrey : theme.jediBlue)};
  padding: 0 20px;
  user-select: none;
  font-size: 30px;

  :hover {
    cursor: pointer;
  }
`

interface DataTextProps {
  area?: string
  fontWeight?: string
}

const DataText = styled(Flex)<DataTextProps>`
  align-items: center;
  text-align: center;
  color: ${({ theme }) => theme.neutral1};

  & > * {
    font-size: 14px;
  }

  @media screen and (max-width: 600px) {
    font-size: 12px;
  }
`

const MobileLabels = styled.div`
  color: #9b9b9b;
  font-size: 12px;
  font-weight: 500;
  flex: 1;
`

const MobileValues = styled.div`
  font-size: 14px;
  flex: 1;
`

const PageTitleHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
`

const VaultMobileContainer = styled.div`
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
  border: 1px solid #959595;
`

function ErrorPanel({ text }: { text?: string }) {
  return (
    <ErrorContainer>
      <ThemedText.BodyPrimary textAlign="center">
        <NetworkIcon strokeWidth={1} style={{ marginTop: '2em' }} />
        <div>
          <Trans>{text || 'An error has occurred. Please try again later.'}</Trans>
        </div>
      </ThemedText.BodyPrimary>
    </ErrorContainer>
  )
}

function NoVaultsPanel() {
  return (
    <NoPositionsContainer>
      <ThemedText.BodyPrimary textAlign="center" fontSize={20}>
        <Trans>No Liquidity has been found. Please deposit in any of our Vaults.</Trans>
      </ThemedText.BodyPrimary>
    </NoPositionsContainer>
  )
}

function PromotionalBanner({ noDecorations = false }) {
  return (
    <PromotionBannerContainer noDecorations={noDecorations}>
      {!noDecorations && <PromotionBannerDecoration src={vaultImage} draggable={false} />}
      <PromotionBannerContent>
        <PromotionBannerTitle>Introducing Vaults</PromotionBannerTitle>
        <PromotionBannerDescription>
          Vaults are dual-asset token pairs used to provide liquidity. Your deposits into selected strategies are
          managed by our strategy partners. Importantly, users have the flexibility to enter and exit at any point in
          time.
        </PromotionBannerDescription>
        <PromotionBannerLink href="https://teahouse.finance/" target="_blank" rel="noopener">
          Learn more
        </PromotionBannerLink>
      </PromotionBannerContent>
    </PromotionBannerContainer>
  )
}

const noop = () => {}

interface ListItemProps {
  index: number
  vaultAddress: string
  vaultData: any
  getUserBalance?: ({ vaultAddress, balance }: UserBalanceResultParams) => void
}

const getVaultDetails = ({
  index,
  vaultAddress,
  vaultData,
  getUserBalance = noop,
}: ListItemProps): {
  tvl: number | undefined
  apr: string | undefined
  currency0: any
  currency1: any
  token0usdPrice: any
  sharesUSDPrice: any
} => {
  const { chainId: chainIdConnected } = useAccountDetails()
  const chainId = chainIdConnected || DEFAULT_CHAIN_ID
  const shareTokenAddress = vaultData?.share?.address
  const performanceData = vaultData.performance[vaultData.mainAssetKey]

  // if (!(vaultData.token0 && vaultData.token1 && shareTokenAddress)) {
  //   return null
  // }

  const currency0: any = new Token(
    vaultData.token0.chainId,
    vaultData.token0.address,
    vaultData.token0.decimals,
    vaultData.token0.symbol,
    vaultData.token0.name
  )
  currency0.logoURI = vaultData.token0.logoURI

  const currency1: any = new Token(
    vaultData.token1.chainId,
    vaultData.token1.address,
    vaultData.token1.decimals,
    vaultData.token1.symbol,
    vaultData.token1.name
  )
  currency1.logoURI = vaultData.token1.logoURI

  //calculating total shares usd value
  const { totalShares, totalToken0Amount, totalToken1Amount } = useUserShares(
    vaultAddress,
    null,
    currency0 ?? undefined,
    currency1 ?? undefined
  )

  useEffect(() => {
    getUserBalance({ vaultAddress, balance: totalShares })
  }, [vaultAddress, totalShares])

  const separatedFiatValueofLiquidity = useQuery({
    queryKey: ['fiat_value', totalToken0Amount, totalToken1Amount, chainId, currency0, currency1],
    queryFn: async () => {
      if ((!totalToken0Amount && !totalToken1Amount) || !chainId || !currency0 || !currency1) return
      const ids = []
      ids.push(currency0?.address, currency1?.address)
      const graphqlClient = getClient(chainId)
      let result = await graphqlClient.query({
        query: TOKENS_DATA({ tokenIds: ids }),
        // fetchPolicy: 'cache-first',
      })

      try {
        if (result.data) {
          const tokensData = result.data.tokensData
          if (tokensData) {
            const [price0Obj, price1Obj] = [tokensData[0], tokensData[1]]
            const isToken0InputAmount =
              validateAndParseAddress(currency0?.address) === validateAndParseAddress(price0Obj.token.tokenAddress)
            const price0 = findClosestPrice(price0Obj?.period)
            const price1 = findClosestPrice(price1Obj?.period)

            return {
              token0usdPrice: isToken0InputAmount ? price0 : price1,
              token1usdPrice: isToken0InputAmount ? price1 : price0,
            }
          }
        }

        return { token0usdPrice: undefined, token1usdPrice: undefined }
      } catch (e) {
        console.log(e)
        return { token0usdPrice: null, token1usdPrice: null }
      }
    },
  })

  const { token0usdPrice, token1usdPrice } = useMemo(() => {
    if (!separatedFiatValueofLiquidity.data || !totalToken0Amount || !totalToken1Amount)
      return { token0usdPrice: undefined, token1usdPrice: undefined }
    return {
      token0usdPrice: separatedFiatValueofLiquidity.data.token0usdPrice
        ? Number(separatedFiatValueofLiquidity.data.token0usdPrice) * Number(totalToken0Amount?.toSignificant())
        : undefined,
      token1usdPrice: separatedFiatValueofLiquidity.data.token1usdPrice
        ? Number(separatedFiatValueofLiquidity.data.token1usdPrice) * Number(totalToken1Amount?.toSignificant())
        : undefined,
    }
  }, [separatedFiatValueofLiquidity, totalToken0Amount, totalToken1Amount])

  const sharesUSDPrice = token0usdPrice && token1usdPrice ? token0usdPrice + token1usdPrice : 0

  let tvl
  let apr
  let shareTokenPriceUsd

  if (!isEmpty(vaultData)) {
    if (separatedFiatValueofLiquidity.data) {
      const mainAssetKey = vaultData.mainAssetKey
      const { token0usdPrice, token1usdPrice } = separatedFiatValueofLiquidity.data
      const mainAssetPrice = mainAssetKey === 'token0' ? token0usdPrice : token1usdPrice
      tvl = mainAssetPrice
        ? (vaultData?.performance?.[mainAssetKey].tvl / 10 ** vaultData[mainAssetKey]?.decimals) *
          Number(mainAssetPrice)
        : 0
    }
    const tokenPrice = vaultData.prices[vaultData.mainAssetKey]
    const shareTokenDecimals = vaultData?.share?.decimals
    const shareTokenPriceInUnits = performanceData.shareTokenPrice / 10 ** (18 + shareTokenDecimals)
    // apr = Number(performanceData.shareTokenApr / 10 ** 4)?.toFixed(2)
    const feeApr = Number(performanceData.feeApr7dAvg / 10 ** 4)
    apr = (feeApr + vaultData.aprStarknet * 100).toFixed(2)
    shareTokenPriceUsd = shareTokenPriceInUnits * tokenPrice
  }
  return { tvl, apr, currency0, currency1, token0usdPrice, sharesUSDPrice }
}

const MobileVaultListItem = ({ index, vaultAddress, vaultData, getUserBalance = noop }: ListItemProps) => {
  const { tvl, apr, currency0, currency1, token0usdPrice, sharesUSDPrice } = getVaultDetails({
    index,
    vaultAddress,
    vaultData,
    getUserBalance,
  })
  return (
    <Link to={`/vaults/${vaultAddress}`} style={{ color: 'unset', textDecoration: 'none' }}>
      <VaultMobileContainer>
        <PageTitleHeader>
          <DoubleCurrencyLogo size={16} currency0={currency0} currency1={currency1} />
          <span
            style={{
              marginLeft: '10px',
            }}
          >
            {currency0?.symbol}-{currency1?.symbol}
          </span>
        </PageTitleHeader>
        <PageTitleRow>
          <MobileLabels>TVL</MobileLabels>
          <MobileLabels>APR</MobileLabels>
          <MobileLabels>My Deposit</MobileLabels>
        </PageTitleRow>
        <PageTitleRow>
          <MobileValues>{tvl ? formatUsdPrice(tvl) : '-'}</MobileValues>
          <MobileValues>{apr ? `${apr}%` : '-'}</MobileValues>
          <MobileValues style={{ color: '#2AAAFE' }}>
            {token0usdPrice && token0usdPrice ? (sharesUSDPrice ? `~$${sharesUSDPrice.toFixed(2)}` : 'NA') : 0}
          </MobileValues>
        </PageTitleRow>
      </VaultMobileContainer>
    </Link>
  )
}

const ListItem = ({ index, vaultAddress, vaultData, getUserBalance = noop }: ListItemProps) => {
  const below600 = useMedia('(max-width: 600px)')
  const below768 = useMedia('(max-width: 768px)')

  const { tvl, apr, currency0, currency1, token0usdPrice, sharesUSDPrice } = getVaultDetails({
    index,
    vaultAddress,
    vaultData,
    getUserBalance,
  })
  return (
    <Link to={`/vaults/${vaultAddress}`} style={{ color: 'unset', textDecoration: 'none' }}>
      <DashGrid style={{ height: '48px' }}>
        <DataText area="name" fontWeight="500">
          {!below600 && <div style={{ width: '10px' }}>{index}</div>}
          <Flex alignItems={'center'} style={{ gap: '8px' }}>
            <DoubleCurrencyLogo size={below600 ? 16 : 24} currency0={currency0} currency1={currency1} margin />
            <StyledTokenName className="pair-name-container">
              {currency0?.symbol}-{currency1?.symbol}
            </StyledTokenName>
            <FeeBadge>{vaultData.feeTier}</FeeBadge>
          </Flex>
        </DataText>
        {!below768 && (
          <DataText area="provider">
            <ProviderLogo src={vaultData.provider.logo} draggable={false} />
          </DataText>
        )}
        <DataText area="tvl">
          <ThemedText.BodySmall>{tvl ? formatUsdPrice(tvl) : '-'}</ThemedText.BodySmall>
        </DataText>
        <DataText area="apr">
          <ThemedText.BodySmall color={'signalGreen'} fontWeight={700}>
            {apr ? `${apr}%` : '-'}
          </ThemedText.BodySmall>
        </DataText>
        <DataText area="deposite">
          <ThemedText.BodySmall>
            <span>
              {token0usdPrice && token0usdPrice ? (sharesUSDPrice ? `~$${sharesUSDPrice.toFixed(2)}` : 'NA') : 0}
            </span>
          </ThemedText.BodySmall>
        </DataText>
      </DashGrid>
    </Link>
  )
}

export default function Vaults({ maxItems = 10 }) {
  const { address, isConnected, chainId } = useAccountDetails()
  const [isMyVaultsFilterEnabled, setIsMyVaultsFilterEnabled] = useState(false)
  const [generalError, setGeneralError] = useState<boolean>(false)
  const [generalLoading, setGeneralLoading] = useState(true)
  interface UserPools {
    [key: string]: number
  }

  const [userPools, setUserPools] = useState<UserPools>({})

  const { data: allVaults, error: allVaultsError, isLoading: isAllVaultsLoading } = useAllVaults()

  const [page, setPage] = useState(1)
  const [maxPage, setMaxPage] = useState(1)
  const ITEMS_PER_PAGE = maxItems

  const below600 = useMedia('(max-width: 600px)')
  const below768 = useMedia('(max-width: 768px)')
  const getFilteredVaults = () => {
    if (!allVaults) {
      return
    }
    if (!isMyVaultsFilterEnabled) {
      return allVaults
    }
    const result = pickBy(allVaults, (value, key) => userPools?.[key] > 0)
    return result
  }

  useEffect(() => {
    getFilteredVaults()
  }, [isMyVaultsFilterEnabled])

  const vaults = getFilteredVaults()
  const vaultsAddresses = Object.keys(vaults ?? {})

  useEffect(() => {
    setMaxPage(1) // edit this to do modular
    setPage(1)
  }, [vaultsAddresses])

  useEffect(() => {
    if (!isConnected) {
      setIsMyVaultsFilterEnabled(false)
    }
    setUserPools({})
  }, [isConnected])
  useEffect(() => {
    setGeneralError(Boolean(allVaultsError))
    setGeneralLoading(isAllVaultsLoading)
  }, [allVaultsError, isAllVaultsLoading])

  useEffect(() => {
    if (!vaultsAddresses?.length) {
      return
    }

    let extraPages = 1
    if (vaultsAddresses.length % ITEMS_PER_PAGE === 0) {
      extraPages = 0
    }
    setMaxPage(Math.floor(vaultsAddresses.length / ITEMS_PER_PAGE) + extraPages)
  }, [ITEMS_PER_PAGE, vaultsAddresses])

  const getUserBalanceResult = ({ vaultAddress, balance }: UserBalanceResultParams): void => {
    setUserPools((pools) => ({
      ...pools,
      [vaultAddress]: balance,
    }))
  }

  const vaultsList = vaultsAddresses
    ?.slice(ITEMS_PER_PAGE * (page - 1), page * ITEMS_PER_PAGE)
    .sort((vaultAddressA, vaultAddressB) => {
      const vaultA = allVaults[vaultAddressA]
      const vaultB = allVaults[vaultAddressB]
      const vaultAPerformanceData = vaultA.performance[vaultA.mainAssetKey]
      const vaultBPerformanceData = vaultB.performance[vaultB.mainAssetKey]
      const vaultAUserDeposit = userPools?.[vaultAddressA]
      const vaultBUserDeposit = userPools?.[vaultAddressB]
      const vaultAValueToCompare =
        isMyVaultsFilterEnabled && vaultAUserDeposit
          ? vaultAUserDeposit
          : vaultAPerformanceData?.feeApr7dAvg / 10 ** 4 + vaultA.aprStarknet * 100
      const vaultBValueToCompare =
        isMyVaultsFilterEnabled && vaultBUserDeposit
          ? vaultBUserDeposit
          : vaultBPerformanceData?.feeApr7dAvg / 10 ** 4 + vaultB.aprStarknet * 100
      if (vaultAValueToCompare < vaultBValueToCompare) {
        return 1
      }
      if (vaultAValueToCompare > vaultBValueToCompare) {
        return -1
      }
      return 0
    })
  const getContent = () => {
    switch (true) {
      case generalError: {
        return <ErrorPanel />
      }
      case generalLoading: {
        return <JediSwapLoader />
      }
      case !vaultsAddresses?.length: {
        return isMyVaultsFilterEnabled ? <NoVaultsPanel /> : <ErrorPanel />
      }
      default: {
        return (
          <TableWrapper>
            <DashGrid
              //   isMyVaultsFilterEnabled={isMyVaultsFilterEnabled}
              style={{
                height: 'fit-content',
                padding: '1rem 1.125rem 1rem 1.125rem',
                backgroundColor: '#ffffff33',
              }}
            >
              <Flex alignItems="center" justifyContent="flexStart">
                <ThemedTextBodySmall area="name" fontWeight={700}>
                  Pool Name
                </ThemedTextBodySmall>
              </Flex>
              {!below768 && (
                <Flex alignItems="center" justifyContent="flexStart">
                  <ThemedTextBodySmall area="provider" fontWeight={700}>
                    Provider
                  </ThemedTextBodySmall>
                </Flex>
              )}
              <Flex alignItems="center" justifyContent="flexStart">
                <ThemedTextBodySmall area="tvl" fontWeight={700}>
                  TVL
                </ThemedTextBodySmall>
              </Flex>
              <Flex alignItems="center" justifyContent="flexStart">
                <ThemedTextBodySmall area="apr" fontWeight={700}>
                  APR
                </ThemedTextBodySmall>
              </Flex>
              <Flex alignItems="center" justifyContent="flexStart">
                <ThemedTextBodySmall area="deposite" textAlign={'center'} fontWeight={700}>
                  My deposit
                </ThemedTextBodySmall>
              </Flex>
            </DashGrid>

            <List>
              {vaultsList.map(
                (vaultAddress, index) =>
                  vaultAddress && (
                    <div key={index}>
                      <ListItem
                        key={index}
                        index={(page - 1) * ITEMS_PER_PAGE + index + 1}
                        vaultAddress={vaultAddress}
                        vaultData={vaults?.[vaultAddress]}
                        getUserBalance={getUserBalanceResult}
                      />
                      <Divider />
                    </div>
                  )
              )}
            </List>

            <PageButtons>
              <div
                onClick={(e) => {
                  setPage(page === 1 ? page : page - 1)
                }}
              >
                <Arrow faded={page === 1}>{'<'}</Arrow>
              </div>
              <ThemedText.BodySmall
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {`${page} of ${maxPage}`}
              </ThemedText.BodySmall>
              <div
                onClick={(e) => {
                  setPage(page === maxPage ? page : page + 1)
                }}
              >
                <Arrow faded={page === maxPage}>{'>'}</Arrow>
              </div>
            </PageButtons>
          </TableWrapper>
        )
      }
    }
  }

  return (
    <PageWrapper>
      <PromotionalBanner noDecorations={below600} />
      <PageTitleRow>
        <PageTitle>Vaults</PageTitle>
        <MyVaultsSwitcherContainer>
          <MyVaultsSwitcherLabel>My vaults</MyVaultsSwitcherLabel>
          <MyVaultsSwitcher
            disabled={!isConnected || generalLoading}
            onChange={(checked) => setIsMyVaultsFilterEnabled(checked)}
            checked={isMyVaultsFilterEnabled}
            handleDiameter={20}
            uncheckedIcon={false}
            checkedIcon={false}
            width={35}
            height={14}
            offHandleColor={'#959595'}
            onHandleColor={'#50D5FF'}
            offColor={'#372554'}
            onColor={'#26346d'}
          />
        </MyVaultsSwitcherContainer>
      </PageTitleRow>
      {below768 ? (
        <>
          {vaultsList.map(
            (vaultAddress, index) =>
              vaultAddress && (
                <div key={index}>
                  <MobileVaultListItem
                    key={index}
                    index={(page - 1) * ITEMS_PER_PAGE + index + 1}
                    vaultAddress={vaultAddress}
                    vaultData={vaults?.[vaultAddress]}
                    getUserBalance={getUserBalanceResult}
                  />
                </div>
              )
          )}
        </>
      ) : (
        getContent()
      )}
    </PageWrapper>
  )
}
