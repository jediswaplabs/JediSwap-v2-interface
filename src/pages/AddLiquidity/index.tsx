import { BigNumber } from '@ethersproject/bignumber'
import type { TransactionResponse } from '@ethersproject/providers'
import { Trans } from '@lingui/macro'
import { BrowserEvent, InterfaceElementName, InterfaceEventName, LiquidityEventName } from '@uniswap/analytics-events'
import { ChainId, Currency, CurrencyAmount, Percent, validateAndParseAddress } from '@vnaysn/jediswap-sdk-core'
import { FeeAmount, NonfungiblePositionManager, Position, toHex } from '@vnaysn/jediswap-sdk-v3'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'react-feather'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Text } from 'rebass'
import styled, { useTheme } from 'styled-components'

import { sendAnalyticsEvent, TraceEvent, useTrace } from 'analytics'
import { useToggleAccountDrawer } from 'components/AccountDrawer'
import OwnershipWarning from 'components/addLiquidity/OwnershipWarning'
import UnsupportedCurrencyFooter from 'components/swap/UnsupportedCurrencyFooter'
import { isSupportedChain } from 'constants/chains'
import usePrevious from 'hooks/usePrevious'
import { useSingleCallResult } from 'lib/hooks/multicall'
import { BodyWrapper } from 'pages/AppBody'
import { PositionPageUnsupportedContent } from 'pages/Pool/PositionPage'
import {
  useRangeHopCallbacks,
  useV3DerivedMintInfo,
  useV3MintActionHandlers,
  useV3MintState,
} from 'state/mint/v3/hooks'
import { ThemedText } from 'theme/components'
import { addressesAreEquivalent } from 'utils/addressesAreEquivalent'
import { WrongChainError } from 'utils/errors'
import { ButtonError, ButtonLight, ButtonPrimary, ButtonText } from '../../components/Button'
import { BlueCard, LightCard, OutlineCard, YellowCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import FeeSelector from '../../components/FeeSelector'
import HoverInlineText from '../../components/HoverInlineText'
import LiquidityChartRangeInput from '../../components/LiquidityChartRangeInput'
import { AddRemoveTabs } from '../../components/NavigationTabs'
import { PositionPreview } from '../../components/PositionPreview'
import RangeSelector from '../../components/RangeSelector'
import PresetsButtons from '../../components/RangeSelector/PresetsButtons'
import RateToggle from '../../components/RateToggle'
import Row, { RowBetween, RowFixed } from '../../components/Row'
import { SwitchLocaleLink } from '../../components/SwitchLocaleLink'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../components/TransactionConfirmationModal'
import { ZERO_PERCENT } from '../../constants/misc'
import { DEFAULT_CHAIN_ID, NONFUNGIBLE_POOL_MANAGER_ADDRESS, WRAPPED_NATIVE_CURRENCY } from '../../constants/tokens'
import { useCurrency } from '../../hooks/Tokens'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import { useArgentWalletContract } from '../../hooks/useArgentWalletContract'
import { useV3NFTPositionManagerContract } from '../../hooks/useContractV2'
import { useDerivedPositionInfo } from '../../hooks/useDerivedPositionInfo'
import { useIsSwapUnsupported } from '../../hooks/useIsSwapUnsupported'
import { useStablecoinValue } from '../../hooks/useStablecoinPrice'
import useTransactionDeadline from '../../hooks/useTransactionDeadline'
import { useV3PosFromTokenId } from '../../hooks/useV3Positions'
import { Bound, Field } from '../../state/mint/v3/actions'
import { useTransactionAdder } from '../../state/transactions/hooks'
import { TransactionInfo, TransactionType } from '../../state/transactions/types'
import { useUserSlippageToleranceWithDefault } from '../../state/user/hooks'
import approveAmountCalldata from '../../utils/approveAmountCalldata'
import { calculateGasMargin } from '../../utils/calculateGasMargin'
import { currencyId } from '../../utils/currencyId'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { Dots } from '../Pool/styled'
import { Review } from './Review'
import { DynamicSection, MediumOnly, ResponsiveTwoColumns, ScrollablePage, StyledInput, Wrapper } from './styled'
import { useAccountDetails } from 'hooks/starknet-react'
import { useContractWrite, useProvider } from '@starknet-react/core'
import { BigNumberish, cairo, Call, CallData, hash, num } from 'starknet'
import JSBI from 'jsbi'
import { toI32 } from 'utils/toI32'
import { useApprovalCall } from 'hooks/useApproveCall'
import { useQuery } from 'react-query'
import { getClient } from 'apollo/client'
import { TOKENS_DATA } from 'apollo/queries'
import { isAddressValidForStarknet } from 'utils/addresses'
import { findClosestPrice } from 'utils/getClosest'

const DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE = new Percent(50, 10_000)

const StyledBodyWrapper = styled(BodyWrapper)<{ $hasExistingPosition: boolean }>`
  padding: ${({ $hasExistingPosition }) => ($hasExistingPosition ? '10px' : 0)};
  max-width: 640px;
`

export default function AddLiquidityWrapper() {
  const { chainId } = useAccountDetails()
  if (true) {
    return <AddLiquidity />
  }
}

function AddLiquidity() {
  const navigate = useNavigate()
  const {
    currencyIdA,
    currencyIdB,
    feeAmount: feeAmountFromUrl,
    tokenId,
  } = useParams<{
    currencyIdA?: string
    currencyIdB?: string
    feeAmount?: string
    tokenId?: string
  }>()
  const { address: account, chainId } = useAccountDetails()
  const theme = useTheme()
  const toggleWalletDrawer = useToggleAccountDrawer() // toggle wallet when disconnected
  const positionManager = useV3NFTPositionManagerContract()
  const parsedTokenId = tokenId ? parseInt(tokenId) : undefined

  // check for existing position if tokenId in url
  const { position: existingPositionDetails, loading: positionLoading } = useV3PosFromTokenId(parsedTokenId)
  const hasExistingPosition = !!existingPositionDetails && !positionLoading
  const { position: existingPosition } = useDerivedPositionInfo(existingPositionDetails)

  // fee selection from url
  const feeAmount: FeeAmount | undefined = feeAmountFromUrl ? Number(feeAmountFromUrl) : undefined

  const baseCurrency = useCurrency(currencyIdA)
  const currencyB = useCurrency(currencyIdB)
  // prevent an error if they input ETH/WETH
  const quoteCurrency =
    baseCurrency && currencyB && baseCurrency.wrapped.equals(currencyB.wrapped) ? undefined : currencyB

  // mint state
  const { independentField, typedValue, startPriceTypedValue } = useV3MintState()

  const [showWarning, setShowWarning] = useState(false)
  const [mintCallData, setMintCallData] = useState<Call[]>([])

  const {
    pool,
    ticks,
    dependentField,
    price,
    pricesAtTicks,
    pricesAtLimit,
    parsedAmounts,
    currencyBalances,
    position,
    noLiquidity,
    currencies,
    errorMessage,
    // invalidPool,
    invalidRange,
    outOfRange,
    depositADisabled,
    depositBDisabled,
    invertPrice,
    ticksAtLimit,
  } = useV3DerivedMintInfo(
    baseCurrency ?? undefined,
    quoteCurrency ?? undefined,
    feeAmount,
    baseCurrency ?? undefined,
    existingPosition
  )

  const invalidPool = false

  const { onFieldAInput, onFieldBInput, onLeftRangeInput, onRightRangeInput, onStartPriceInput } =
    useV3MintActionHandlers(noLiquidity)

  const { writeAsync, data: txData } = useContractWrite({
    calls: mintCallData,
  })

  const isValid = !errorMessage && !invalidRange

  // modal and loading
  const [showConfirm, setShowConfirm] = useState<boolean>(false)
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm

  // txn values
  const deadline = useTransactionDeadline() // custom from users settings

  const [txHash, setTxHash] = useState<string>('')

  // get formatted amounts
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
  }

  const usdcValues = {
    [Field.CURRENCY_A]: useStablecoinValue(parsedAmounts[Field.CURRENCY_A]),
    [Field.CURRENCY_B]: useStablecoinValue(parsedAmounts[Field.CURRENCY_B]),
  }
  const spenderAddress: string = NONFUNGIBLE_POOL_MANAGER_ADDRESS[chainId ?? DEFAULT_CHAIN_ID]

  // check whether the user has approved the router on the tokens
  const approvalACallback = useApprovalCall(parsedAmounts[Field.CURRENCY_A], spenderAddress)
  const approvalBCallback = useApprovalCall(parsedAmounts[Field.CURRENCY_B], spenderAddress)
  // get the max amounts user can add
  const maxAmounts: { [field in Field]?: CurrencyAmount<Currency> } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => ({
      ...accumulator,
      [field]: maxAmountSpend(currencyBalances[field]),
    }),
    {}
  )

  const atMaxAmounts: { [field in Field]?: CurrencyAmount<Currency> } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => ({
      ...accumulator,
      [field]: maxAmounts[field]?.equalTo(parsedAmounts[field] ?? '0'),
    }),
    {}
  )

  const allowedSlippage = useUserSlippageToleranceWithDefault(
    outOfRange ? ZERO_PERCENT : DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE
  )

  const separatedFiatValueofLiquidity = useQuery({
    queryKey: ['fiat_value', position?.amount0, position?.amount1],
    queryFn: async () => {
      const ids = []
      if (!position?.amount0 && !position?.amount1) return
      if (position?.amount0) ids.push(position?.amount0.currency.address)
      if (position?.amount1) ids.push(position?.amount1.currency.address)
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
              isAddressValidForStarknet(position?.amount0.currency.address) ===
              isAddressValidForStarknet(price0Obj.token.tokenAddress)
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
    if (!separatedFiatValueofLiquidity.data) return { token0usdPrice: undefined, token1usdPrice: undefined }

    const token0usdPrice = separatedFiatValueofLiquidity.data.token0usdPrice
      ? Number(separatedFiatValueofLiquidity.data.token0usdPrice) * Number(position?.amount0.toSignificant())
      : undefined
    const token1usdPrice = separatedFiatValueofLiquidity.data.token1usdPrice
      ? Number(separatedFiatValueofLiquidity.data.token1usdPrice) * Number(position?.amount1.toSignificant())
      : undefined
    
    const parsedAddressA = (parsedAmounts.CURRENCY_A?.currency as any)?.address
    const parsedAddressB = (parsedAmounts.CURRENCY_B?.currency as any)?.address
    const isLiquidityToken0PositionToken0 = parsedAddressA ?
      position?.amount0.currency.address === parsedAddressA :
      position?.amount1.currency.address === parsedAddressB;
    
    return {
      token0usdPrice: isLiquidityToken0PositionToken0 ? token0usdPrice : token1usdPrice,
      token1usdPrice: isLiquidityToken0PositionToken0 ? token1usdPrice : token0usdPrice,
    }
  }, [separatedFiatValueofLiquidity])

  useEffect(() => {
    if (txData) console.log(txData, 'txData')
  }, [txData])

  useEffect(() => {
    if (chainId) {
      if (chainId === ChainId.GOERLI) setShowWarning(false)
    }
  }, [chainId])

  useEffect(() => {
    if (mintCallData) {
      writeAsync()
        .then((response) => {
          setAttemptingTxn(false)
          if (response?.transaction_hash) {
            setTxHash(response.transaction_hash)
          }
        })
        .catch((err) => {
          console.log(err?.message)
          setAttemptingTxn(false)
        })
    }
  }, [mintCallData])

  async function onAdd() {
    if (!chainId || !account) {
      return
    }

    if (!positionManager || !baseCurrency || !quoteCurrency || !parsedAmounts) {
      return
    }

    let approvalA = undefined
    let approvalB = undefined

    if (parsedAmounts[Field.CURRENCY_A] && Number(parsedAmounts?.[Field.CURRENCY_A]?.raw.toString()) > 0)
      approvalA = approvalACallback()
    if (parsedAmounts[Field.CURRENCY_B] && Number(parsedAmounts?.[Field.CURRENCY_B]?.raw.toString()) > 0)
      approvalB = approvalBCallback()

    if (position && account && deadline) {
      // get amounts
      const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts

      // adjust for slippage
      const minimumAmounts = position.mintAmountsWithSlippage(allowedSlippage)
      const amount0Min = minimumAmounts.amount0
      const amount1Min = minimumAmounts.amount1
      const router_address: string = NONFUNGIBLE_POOL_MANAGER_ADDRESS[chainId ?? DEFAULT_CHAIN_ID]

      if (hasExistingPosition && tokenId) {
        const hasExistingLiquidity = hasExistingPosition && tokenId
        let mintData = {}
        if (hasExistingLiquidity) {
          mintData = {
            tokenId: cairo.uint256(tokenId),
            amount0_desired: cairo.uint256(amount0Desired.toString()),
            amount1_desired: cairo.uint256(amount1Desired.toString()),
            amount0_min: cairo.uint256(amount0Min.toString()),
            amount1_min: cairo.uint256(amount1Min.toString()),
            deadline: cairo.felt(deadline.toString()),
          }
        }
        const callData = CallData.compile(mintData)

        const calls = {
          contractAddress: router_address,
          entrypoint: 'increase_liquidity',
          calldata: callData,
        }

        if (approvalA && approvalB) {
          setMintCallData([approvalA, approvalB, calls])
        } else {
          if (approvalA) {
            setMintCallData([approvalA, calls])
          } else if (approvalB) {
            setMintCallData([approvalB, calls])
          }
        }
      } else {
        const callData = []
        if (noLiquidity) {
          //create and initialize pool
          const initializeData = {
            token0: position.pool.token0.address,
            token1: position.pool.token1.address,
            fee: position.pool.fee,
            sqrt_price_X96: cairo.uint256(position?.pool?.sqrtRatioX96.toString()),
          }

          const initializeCallData = CallData.compile(initializeData)
          const icalls = {
            contractAddress: router_address,
            entrypoint: 'create_and_initialize_pool',
            calldata: initializeCallData,
          }
          callData.push(icalls)
        }
        //mint position
        const mintData = {
          token0: position.pool.token0.address,
          token1: position.pool.token1.address,
          fee: position.pool.fee,
          tick_lower: toI32(position.tickLower),
          tick_upper: toI32(position.tickUpper),
          amount0_desired: cairo.uint256(amount0Desired.toString()),
          amount1_desired: cairo.uint256(amount1Desired.toString()),
          amount0_min: cairo.uint256(amount0Min.toString()),
          amount1_min: cairo.uint256(amount1Min.toString()),
          recipient: account,
          deadline: cairo.felt(deadline.toString()),
        }
        const mintCallData = CallData.compile(mintData)
        const mcalls = {
          contractAddress: router_address,
          entrypoint: 'mint',
          calldata: mintCallData,
        }
        if (approvalA && approvalB) {
          callData.push(approvalA, approvalB, mcalls)
        } else {
          if (approvalA) {
            callData.push(approvalA, mcalls)
          } else if (approvalB) {
            callData.push(approvalB, mcalls)
          }
        }
        setMintCallData(callData)
      }

      setAttemptingTxn(true)
    } else {
      return
    }
  }

  const handleCurrencySelect = useCallback(
    (currencyNew: Currency, currencyIdOther?: string): (string | undefined)[] => {
      const currencyIdNew = currencyId(currencyNew)

      if (currencyIdNew === currencyIdOther) {
        // not ideal, but for now clobber the other if the currency ids are equal
        return [currencyIdNew, undefined]
      }
      // prevent weth + eth
      const isETHOrWETHNew =
        currencyIdNew === 'ETH' ||
        (chainId !== undefined && currencyIdNew === WRAPPED_NATIVE_CURRENCY[chainId]?.address)
      const isETHOrWETHOther =
        currencyIdOther !== undefined &&
        (currencyIdOther === 'ETH' ||
          (chainId !== undefined && currencyIdOther === WRAPPED_NATIVE_CURRENCY[chainId]?.address))

      if (isETHOrWETHNew && isETHOrWETHOther) {
        return [currencyIdNew, undefined]
      }
      return [currencyIdNew, currencyIdOther]
    },
    [chainId]
  )

  const handleCurrencyASelect = useCallback(
    (currencyANew: Currency) => {
      const [idA, idB] = handleCurrencySelect(currencyANew, currencyIdB)
      if (idB === undefined) {
        navigate(`/add/${idA}`)
      } else {
        navigate(`/add/${idA}/${idB}`)
      }
    },
    [handleCurrencySelect, currencyIdB, navigate]
  )

  const handleCurrencyBSelect = useCallback(
    (currencyBNew: Currency) => {
      const [idB, idA] = handleCurrencySelect(currencyBNew, currencyIdA)
      if (idA === undefined) {
        navigate(`/add/${idB}`)
      } else {
        navigate(`/add/${idA}/${idB}`)
      }
    },
    [handleCurrencySelect, currencyIdA, navigate]
  )

  const handleFeePoolSelect = useCallback(
    (newFeeAmount: FeeAmount) => {
      onLeftRangeInput('')
      onRightRangeInput('')
      navigate(`/add/${currencyIdA}/${currencyIdB}/${newFeeAmount}`)
    },
    [currencyIdA, currencyIdB, navigate, onLeftRangeInput, onRightRangeInput]
  )

  const handleDismissConfirmation = useCallback(() => {
    setShowConfirm(false)
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onFieldAInput('')
      // dont jump to pool page if creating
      navigate('/pools')
    }
    setTxHash('')
  }, [navigate, onFieldAInput, txHash])

  const addIsUnsupported = useIsSwapUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  const clearAll = useCallback(() => {
    onFieldAInput('')
    onFieldBInput('')
    onLeftRangeInput('')
    onRightRangeInput('')
    navigate('/add')
  }, [navigate, onFieldAInput, onFieldBInput, onLeftRangeInput, onRightRangeInput])

  // get value and prices at ticks
  const { [Bound.LOWER]: tickLower, [Bound.UPPER]: tickUpper } = ticks
  const { [Bound.LOWER]: priceLower, [Bound.UPPER]: priceUpper } = pricesAtTicks

  const { getSetFullRange } = useRangeHopCallbacks(
    baseCurrency ?? undefined,
    quoteCurrency ?? undefined,
    feeAmount,
    tickLower,
    tickUpper,
    pool
  )

  const pendingText = `Supplying ${!depositADisabled ? parsedAmounts[Field.CURRENCY_A]?.toSignificant(6) : ''} ${
    !depositADisabled ? currencies[Field.CURRENCY_A]?.symbol : ''
  } ${!outOfRange ? 'and' : ''} ${!depositBDisabled ? parsedAmounts[Field.CURRENCY_B]?.toSignificant(6) : ''} ${
    !depositBDisabled ? currencies[Field.CURRENCY_B]?.symbol : ''
  }`

  const [searchParams, setSearchParams] = useSearchParams()

  const handleSetFullRange = useCallback(() => {
    getSetFullRange()

    const minPrice = pricesAtLimit[Bound.LOWER]
    if (minPrice) {
      searchParams.set('minPrice', minPrice.toSignificant(5))
    }
    const maxPrice = pricesAtLimit[Bound.UPPER]
    if (maxPrice) {
      searchParams.set('maxPrice', maxPrice.toSignificant(5))
    }
    setSearchParams(searchParams)
  }, [getSetFullRange, pricesAtLimit, searchParams, setSearchParams])

  // START: sync values with query string
  const oldSearchParams = usePrevious(searchParams)
  // use query string as an input to onInput handlers
  useEffect(() => {
    const minPrice = searchParams.get('minPrice')
    const oldMinPrice = oldSearchParams?.get('minPrice')
    if (
      minPrice &&
      typeof minPrice === 'string' &&
      !isNaN(minPrice as any) &&
      (!oldMinPrice || oldMinPrice !== minPrice)
    ) {
      onLeftRangeInput(minPrice)
    }
    // disable eslint rule because this hook only cares about the url->input state data flow
    // input state -> url updates are handled in the input handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  useEffect(() => {
    const maxPrice = searchParams.get('maxPrice')
    const oldMaxPrice = oldSearchParams?.get('maxPrice')
    if (
      maxPrice &&
      typeof maxPrice === 'string' &&
      !isNaN(maxPrice as any) &&
      (!oldMaxPrice || oldMaxPrice !== maxPrice)
    ) {
      onRightRangeInput(maxPrice)
    }
    // disable eslint rule because this hook only cares about the url->input state data flow
    // input state -> url updates are handled in the input handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  // END: sync values with query string

  const Buttons = () =>
    !account ? (
      <ButtonPrimary onClick={toggleWalletDrawer} $borderRadius="12px" style={{padding: '12px', fontSize: '18px'}}>
        <Trans>Connect wallet</Trans>
      </ButtonPrimary>
    ) : (
      <AutoColumn gap="md">
        <ButtonError
          onClick={() => {
            setShowConfirm(true)
          }}
          disabled={!isValid || showWarning}
          error={!isValid && !!parsedAmounts[Field.CURRENCY_A] && !!parsedAmounts[Field.CURRENCY_B]}
        >
          <Text fontWeight={535}>
            {showWarning ? 'Add liquidity is paused' : errorMessage ? errorMessage : <Trans>Preview</Trans>}
          </Text>
        </ButtonError>
      </AutoColumn>
    )

  // const owner = useSingleCallResult(tokenId ? positionManager : null, 'ownerOf', [tokenId]).result?.[0]
  // const ownsNFT =
  //   addressesAreEquivalent(owner, account) || addressesAreEquivalent(existingPositionDetails?.operator, account)
  // const showOwnershipWarning = Boolean(hasExistingPosition && account && !ownsNFT)

  return (
    <>
      <ScrollablePage>
        <TransactionConfirmationModal
          isOpen={showConfirm}
          onDismiss={handleDismissConfirmation}
          attemptingTxn={attemptingTxn}
          hash={txHash}
          reviewContent={() => (
            <ConfirmationModalContent
              title={<Trans>Add Liquidity</Trans>}
              onDismiss={handleDismissConfirmation}
              topContent={() => (
                <Review
                  parsedAmounts={parsedAmounts}
                  position={position}
                  existingPosition={existingPosition}
                  priceLower={priceLower}
                  priceUpper={priceUpper}
                  outOfRange={outOfRange}
                  ticksAtLimit={ticksAtLimit}
                />
              )}
              bottomContent={() => (
                <ButtonPrimary style={{ marginTop: '1rem' }} onClick={onAdd}>
                  <Text fontWeight={535} fontSize={20}>
                    <Trans>Add</Trans>
                  </Text>
                </ButtonPrimary>
              )}
            />
          )}
          pendingText={pendingText}
        />
        <StyledBodyWrapper $hasExistingPosition={hasExistingPosition}>
          <AddRemoveTabs
            creating={false}
            adding
            positionID={tokenId}
            autoSlippage={DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE}
            showBackLink={!hasExistingPosition}
          >
            {!hasExistingPosition && (
              <Row justifyContent="flex-end" style={{ width: 'fit-content', minWidth: 'fit-content' }}>
                <MediumOnly>
                  <ButtonText onClick={clearAll}>
                    <ThemedText.DeprecatedBlue fontSize="14px" style={{ color: theme.jediBlue, fontWeight: '700' }}>
                      <Trans>Clear all</Trans>
                    </ThemedText.DeprecatedBlue>
                  </ButtonText>
                </MediumOnly>
              </Row>
            )}
          </AddRemoveTabs>
          <Wrapper>
            <ResponsiveTwoColumns wide={!hasExistingPosition}>
              <AutoColumn gap="lg">
                {!hasExistingPosition && (
                  <>
                    <AutoColumn gap="md">
                      <RowBetween paddingBottom="20px">
                        <ThemedText.SubHeader style={{ fontFamily: 'DM Sans', fontWeight: '500' }}>
                          <Trans>Select pair</Trans>
                        </ThemedText.SubHeader>
                      </RowBetween>
                      <RowBetween gap="md">
                        <CurrencyInputPanel
                          value={formattedAmounts[Field.CURRENCY_A]}
                          onUserInput={onFieldAInput}
                          hideInput
                          onMax={() => {
                            onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                          }}
                          onCurrencySelect={handleCurrencyASelect}
                          showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
                          currency={currencies[Field.CURRENCY_A] ?? null}
                          id="add-liquidity-input-tokena"
                          showCommonBases
                          hideShadow
                        />

                        <CurrencyInputPanel
                          value={formattedAmounts[Field.CURRENCY_B]}
                          hideInput
                          onUserInput={onFieldBInput}
                          onCurrencySelect={handleCurrencyBSelect}
                          onMax={() => {
                            onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
                          }}
                          showMaxButton={!atMaxAmounts[Field.CURRENCY_B]}
                          currency={currencies[Field.CURRENCY_B] ?? null}
                          id="add-liquidity-input-tokenb"
                          showCommonBases
                          hideShadow
                        />
                      </RowBetween>

                      <FeeSelector
                        disabled={!quoteCurrency || !baseCurrency}
                        feeAmount={feeAmount}
                        handleFeePoolSelect={handleFeePoolSelect}
                      />
                    </AutoColumn>{' '}
                  </>
                )}
                {hasExistingPosition && existingPosition && (
                  <PositionPreview
                    position={existingPosition}
                    title={<Trans>Selected range</Trans>}
                    inRange={!outOfRange}
                    ticksAtLimit={ticksAtLimit}
                  />
                )}
              </AutoColumn>

              {!hasExistingPosition && (
                <>
                  <DynamicSection gap="md" disabled={!feeAmount || invalidPool}>
                    <RowBetween>
                      <ThemedText.DeprecatedLabel>
                        <Trans>Set price range</Trans>
                      </ThemedText.DeprecatedLabel>

                      {Boolean(baseCurrency && quoteCurrency) && (
                        <RowFixed gap="8px">
                          <PresetsButtons onSetFullRange={handleSetFullRange} />
                          <RateToggle
                            currencyA={baseCurrency as Currency}
                            currencyB={quoteCurrency as Currency}
                            handleRateToggle={() => {
                              if (!ticksAtLimit[Bound.LOWER] && !ticksAtLimit[Bound.UPPER]) {
                                onLeftRangeInput(
                                  (invertPrice ? priceLower : priceUpper?.invert())?.toSignificant(6) ?? ''
                                )
                                onRightRangeInput(
                                  (invertPrice ? priceUpper : priceLower?.invert())?.toSignificant(6) ?? ''
                                )
                                onFieldAInput(formattedAmounts[Field.CURRENCY_B] ?? '')
                              }
                              navigate(
                                `/add/${currencyIdB as string}/${currencyIdA as string}${
                                  feeAmount ? `/${feeAmount}` : ''
                                }`
                              )
                            }}
                          />
                        </RowFixed>
                      )}
                    </RowBetween>
                    {/* <LiquidityChartRangeInput
                      currencyA={baseCurrency ?? undefined}
                      currencyB={quoteCurrency ?? undefined}
                      feeAmount={feeAmount}
                      ticksAtLimit={ticksAtLimit}
                      price={price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined}
                      priceLower={priceLower}
                      priceUpper={priceUpper}
                      onLeftRangeInput={onLeftRangeInput}
                      onRightRangeInput={onRightRangeInput}
                      interactive={!hasExistingPosition}
                    /> */}
                    <RangeSelector
                      priceLower={priceLower}
                      priceUpper={priceUpper}
                      onLeftRangeInput={onLeftRangeInput}
                      onRightRangeInput={onRightRangeInput}
                      currencyA={baseCurrency}
                      currencyB={quoteCurrency}
                      feeAmount={feeAmount}
                      ticksAtLimit={ticksAtLimit}
                    />

                    {outOfRange && (
                      <YellowCard padding="8px 12px" $borderRadius="12px">
                        <RowBetween>
                          <AlertTriangle stroke={theme.jediPink} size="16px" />
                          <ThemedText.UtilityBadge ml="12px" fontSize="12px" fontWeight={600}>
                            <Trans>
                              Your position will not earn fees or be used in trades until the market price moves into
                              your range.
                            </Trans>
                          </ThemedText.UtilityBadge>
                        </RowBetween>
                      </YellowCard>
                    )}
                    {invalidRange && (
                      <YellowCard padding="8px 12px" $borderRadius="12px">
                        <Row>
                          <AlertTriangle stroke={theme.jediPink} size="16px" />
                          <ThemedText.UtilityBadge ml="12px" fontSize="12px" fontWeight={600}>
                            <Trans>Invalid range selected. The min price must be lower than the max price.</Trans>
                          </ThemedText.UtilityBadge>
                        </Row>
                      </YellowCard>
                    )}
                  </DynamicSection>

                  <DynamicSection gap="md" disabled={!feeAmount || invalidPool}>
                    {!noLiquidity ? (
                      <>
                        {Boolean(price && baseCurrency && quoteCurrency) && (
                          <AutoColumn gap="2px" style={{ marginTop: '0.5rem' }}>
                            <Trans>
                              <ThemedText.DeprecatedMain fontWeight={535} fontSize={12} color="text1">
                                Current price:
                              </ThemedText.DeprecatedMain>
                              <ThemedText.DeprecatedBody fontWeight={535} fontSize={20} color="text1">
                                {price && (
                                  <HoverInlineText
                                    maxCharacters={20}
                                    text={invertPrice ? price.invert().toSignificant(6) : price.toSignificant(6)}
                                  />
                                )}
                              </ThemedText.DeprecatedBody>
                              {baseCurrency && (
                                <ThemedText.DeprecatedBody color="text2" fontSize={12}>
                                  {quoteCurrency?.symbol} per {baseCurrency.symbol}
                                </ThemedText.DeprecatedBody>
                              )}
                            </Trans>
                          </AutoColumn>
                        )}
                      </>
                    ) : (
                      <AutoColumn gap="md">
                        {noLiquidity && (
                          <BlueCard
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: '1rem 1rem',
                            }}
                          >
                            <ThemedText.DeprecatedBody fontSize={12} textAlign="left" color={theme.accent1}>
                              <Trans>
                                This pool must be initialized before you can add liquidity. To initialize, select a
                                starting price for the pool. Then, enter your liquidity price range and deposit amount.
                                Gas fees will be higher than usual due to the initialization transaction.
                              </Trans>
                            </ThemedText.DeprecatedBody>
                          </BlueCard>
                        )}
                        <LightCard padding="12px">
                          <StyledInput
                            className="start-price-input"
                            value={startPriceTypedValue}
                            onUserInput={onStartPriceInput}
                          />
                        </LightCard>
                        <RowBetween
                          style={{
                            padding: '12px',
                            borderRadius: '12px',
                          }}
                        >
                          <ThemedText.DeprecatedMain>
                            <Trans>Starting {baseCurrency?.symbol} Price:</Trans>
                          </ThemedText.DeprecatedMain>
                          <ThemedText.DeprecatedMain>
                            {price ? (
                              <ThemedText.DeprecatedMain>
                                <RowFixed>
                                  <HoverInlineText
                                    maxCharacters={20}
                                    text={invertPrice ? price?.invert()?.toSignificant(8) : price?.toSignificant(8)}
                                  />{' '}
                                  <span style={{ marginLeft: '4px' }}>
                                    {quoteCurrency?.symbol} per {baseCurrency?.symbol}
                                  </span>
                                </RowFixed>
                              </ThemedText.DeprecatedMain>
                            ) : (
                              '-'
                            )}
                          </ThemedText.DeprecatedMain>
                        </RowBetween>
                      </AutoColumn>
                    )}
                  </DynamicSection>
                </>
              )}
              <div>
                <DynamicSection disabled={invalidPool || invalidRange || (noLiquidity && !startPriceTypedValue)}>
                  <AutoColumn gap="md">
                    <ThemedText.DeprecatedLabel>
                      {hasExistingPosition ? <Trans>Add more liquidity</Trans> : <Trans>Deposit amounts</Trans>}
                    </ThemedText.DeprecatedLabel>

                    <CurrencyInputPanel
                      value={formattedAmounts[Field.CURRENCY_A]}
                      onUserInput={onFieldAInput}
                      onMax={() => {
                        onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                      }}
                      showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
                      currency={currencies[Field.CURRENCY_A] ?? null}
                      id="add-liquidity-input-tokena"
                      fiatValue={token0usdPrice}
                      showCommonBases
                      locked={depositADisabled}
                    />

                    <CurrencyInputPanel
                      value={formattedAmounts[Field.CURRENCY_B]}
                      onUserInput={onFieldBInput}
                      onMax={() => {
                        onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
                      }}
                      showMaxButton={!atMaxAmounts[Field.CURRENCY_B]}
                      fiatValue={token1usdPrice}
                      currency={currencies[Field.CURRENCY_B] ?? null}
                      id="add-liquidity-input-tokenb"
                      showCommonBases
                      locked={depositBDisabled}
                    />
                  </AutoColumn>
                </DynamicSection>
              </div>
              <Buttons />
            </ResponsiveTwoColumns>
          </Wrapper>
        </StyledBodyWrapper>
        {addIsUnsupported && (
          <UnsupportedCurrencyFooter
            show={addIsUnsupported}
            currencies={[currencies.CURRENCY_A, currencies.CURRENCY_B]}
          />
        )}
      </ScrollablePage>
      <SwitchLocaleLink />
    </>
  )
}
