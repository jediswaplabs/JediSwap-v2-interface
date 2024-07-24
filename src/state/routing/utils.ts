import { MixedRouteSDK } from '@vnaysn/jediswap-router-sdk'
import { Currency, CurrencyAmount, Percent, Token, TradeType } from '@vnaysn/jediswap-sdk-core'
// import { DutchOrderInfo, DutchOrderInfoJSON } from '@uniswap/uniswapx-sdk'
import { Pair, Route as V2Route } from '@vnaysn/jediswap-sdk-v2'
import { FeeAmount, Pool, Route as V3Route } from '@vnaysn/jediswap-sdk-v3'
import { BIPS_BASE } from 'constants/misc'
import { nativeOnChain } from 'constants/tokens'

// import { getApproveInfo } from './gas'
import {
  ClassicQuoteData,
  ClassicTrade,
  // DutchOrderTrade,
  GetQuickQuoteArgs,
  GetQuoteArgs,
  InterfaceTrade,
  isClassicQuoteResponse,
  PoolType,
  PreviewTrade,
  QuickRouteResponse,
  QuoteMethod,
  QuoteState,
  SubmittableTrade,
  SwapFeeInfo,
  SwapRouterNativeAssets,
  TradeFillType,
  TradeResult,
  URADutchOrderQuoteData,
  URAQuoteResponse,
  URAQuoteType,
  V2PoolInRoute,
  V3PoolInRoute,
} from './types'

interface RouteResult {
  routev3: V3Route<Currency, Currency> | null
  routev2: V2Route<Currency, Currency> | null
  mixedRoute: MixedRouteSDK<Currency, Currency> | null
  inputAmount: CurrencyAmount<Currency>
  outputAmount: CurrencyAmount<Currency>
}

/**
 * Transforms a Routing API quote into an array of routes that can be used to
 * create a `Trade`.
 */
export function computeRoutes(
  currencyIn: Currency,
  currencyOut: Currency,
  routes: ClassicQuoteData['route']
): RouteResult[] | undefined {
  if (routes.length === 0) return []

  const tokenIn = routes[0]?.[0]?.tokenIn
  const tokenOut = routes[0]?.[routes[0]?.length - 1]?.tokenOut
  if (!tokenIn || !tokenOut) throw new Error('Expected both tokenIn and tokenOut to be present')

  try {
    return routes.map((route) => {
      if (route.length === 0) {
        throw new Error('Expected route to have at least one pair or pool')
      }
      const rawAmountIn = route[0].amountIn
      const rawAmountOut = route[route.length - 1].amountOut

      if (!rawAmountIn || !rawAmountOut) {
        throw new Error('Expected both amountIn and amountOut to be present')
      }

      const isOnlyV2 = isVersionedRoute<V2PoolInRoute>(PoolType.V2Pool, route)
      const isOnlyV3 = isVersionedRoute<V3PoolInRoute>(PoolType.V3Pool, route)

      return {
        routev3: isOnlyV3 ? new V3Route(route.map(parsePool), currencyIn, currencyOut) : null,
        routev2: isOnlyV2 ? new V2Route(route.map(parsePair), currencyIn, currencyOut) : null,
        mixedRoute:
          !isOnlyV3 && !isOnlyV2 ? new MixedRouteSDK(route.map(parsePoolOrPair), currencyIn, currencyOut) : null,
        inputAmount: CurrencyAmount.fromRawAmount(currencyIn, rawAmountIn),
        outputAmount: CurrencyAmount.fromRawAmount(currencyOut, rawAmountOut),
      }
    })
  } catch (e) {
    console.error('Error computing routes', e)
    return
  }
}

const parsePoolOrPair = (pool: V3PoolInRoute | V2PoolInRoute): Pool | Pair => {
  return pool.type === PoolType.V3Pool ? parsePool(pool) : parsePair(pool)
}

function isVersionedRoute<T extends V2PoolInRoute | V3PoolInRoute>(
  type: T['type'],
  route: (V3PoolInRoute | V2PoolInRoute)[]
): route is T[] {
  return route.every((pool) => pool.type === type)
}

// Prepares the currencies used for the actual Swap (either UniswapX or Universal Router)
// May not match `currencyIn` that the user selected because for ETH inputs in UniswapX, the actual
// swap will use WETH.
function getTradeCurrencies(args: GetQuoteArgs | GetQuickQuoteArgs, isUniswapXTrade: boolean): [Currency, Currency] {
  const {
    tokenInAddress,
    tokenInChainId,
    tokenInDecimals,
    tokenInSymbol,
    tokenOutAddress,
    tokenOutChainId,
    tokenOutDecimals,
    tokenOutSymbol,
  } = args

  const tokenInIsNative = Object.values(SwapRouterNativeAssets).includes(tokenInAddress as SwapRouterNativeAssets)
  const tokenOutIsNative = Object.values(SwapRouterNativeAssets).includes(tokenOutAddress as SwapRouterNativeAssets)

  const currencyIn = tokenInIsNative
    ? nativeOnChain(tokenInChainId)
    : parseToken({ address: tokenInAddress, chainId: tokenInChainId, decimals: tokenInDecimals, symbol: tokenInSymbol })
  const currencyOut = tokenOutIsNative
    ? nativeOnChain(tokenOutChainId)
    : parseToken({
        address: tokenOutAddress,
        chainId: tokenOutChainId,
        decimals: tokenOutDecimals,
        symbol: tokenOutSymbol,
      })

  if (!isUniswapXTrade) {
    return [currencyIn, currencyOut]
  }

  return [currencyIn.isNative ? currencyIn.wrapped : currencyIn, currencyOut]
}

function getSwapFee(data: ClassicQuoteData | URADutchOrderQuoteData): SwapFeeInfo | undefined {
  const { portionAmount, portionBips, portionRecipient } = data

  if (!portionAmount || !portionBips || !portionRecipient) return undefined

  return {
    recipient: portionRecipient,
    percent: new Percent(portionBips, BIPS_BASE),
    amount: portionAmount,
  }
}

function getClassicTradeDetails(
  currencyIn: Currency,
  currencyOut: Currency,
  data: URAQuoteResponse
): {
  gasUseEstimate?: number
  gasUseEstimateUSD?: number
  blockNumber?: string
  routes?: RouteResult[]
  swapFee?: SwapFeeInfo
} {
  const classicQuote =
    data.routing === URAQuoteType.CLASSIC ? data.quote : data.allQuotes.find(isClassicQuoteResponse)?.quote

  if (!classicQuote) return {}

  return {
    gasUseEstimate: classicQuote.gasUseEstimate ? parseFloat(classicQuote.gasUseEstimate) : undefined,
    gasUseEstimateUSD: classicQuote.gasUseEstimateUSD ? parseFloat(classicQuote.gasUseEstimateUSD) : undefined,
    blockNumber: classicQuote.blockNumber,
    routes: computeRoutes(currencyIn, currencyOut, classicQuote.route),
    swapFee: getSwapFee(classicQuote),
  }
}

export function transformQuickRouteToTrade(args: GetQuickQuoteArgs, data: QuickRouteResponse): PreviewTrade {
  const { amount, tradeType, inputTax, outputTax } = args
  const [currencyIn, currencyOut] = getTradeCurrencies(args, false)
  const [rawAmountIn, rawAmountOut] =
    data.tradeType === 'EXACT_IN' ? [amount, data.quote.amount] : [data.quote.amount, amount]
  const inputAmount = CurrencyAmount.fromRawAmount(currencyIn, rawAmountIn)
  const outputAmount = CurrencyAmount.fromRawAmount(currencyOut, rawAmountOut)

  return new PreviewTrade({ inputAmount, outputAmount, tradeType, inputTax, outputTax })
}

export async function transformRoutesToTrade(
  args: GetQuoteArgs,
  data: URAQuoteResponse,
  quoteMethod: QuoteMethod
): Promise<TradeResult> {
  const { tradeType, inputTax, outputTax } = args

  const [currencyIn, currencyOut] = getTradeCurrencies(args, false)
  const { gasUseEstimateUSD, blockNumber, routes, gasUseEstimate, swapFee } = getClassicTradeDetails(
    currencyIn,
    currencyOut,
    data
  )

  // Some sus javascript float math but it's ok because its just an estimate for display purposes
  // const usdCostPerGas = gasUseEstimateUSD && gasUseEstimate ? gasUseEstimateUSD / gasUseEstimate : undefined

  // const approveInfo = await getApproveInfo(account, currencyIn, amount, usdCostPerGas)
  const classicTrade = new ClassicTrade({
    v2Routes:
      routes
        ?.filter((r): r is RouteResult & { routev2: NonNullable<RouteResult['routev2']> } => r.routev2 !== null)
        .map(({ routev2, inputAmount, outputAmount }) => ({
          routev2,
          inputAmount,
          outputAmount,
        })) ?? [],
    v3Routes:
      routes
        ?.filter((r): r is RouteResult & { routev3: NonNullable<RouteResult['routev3']> } => r.routev3 !== null)
        .map(({ routev3, inputAmount, outputAmount }) => ({
          routev3,
          inputAmount,
          outputAmount,
        })) ?? [],
    mixedRoutes:
      routes
        ?.filter(
          (r): r is RouteResult & { mixedRoute: NonNullable<RouteResult['mixedRoute']> } => r.mixedRoute !== null
        )
        .map(({ mixedRoute, inputAmount, outputAmount }) => ({
          mixedRoute,
          inputAmount,
          outputAmount,
        })) ?? [],
    tradeType,
    gasUseEstimateUSD,
    blockNumber,
    requestId: data.quote.requestId,
    quoteMethod,
    inputTax,
    outputTax,
    swapFee,
  })

  return { state: QuoteState.SUCCESS, trade: classicTrade }
}

function parseToken({ address, chainId, decimals, symbol }: ClassicQuoteData['route'][0][0]['tokenIn']): Token {
  return new Token(chainId, address, parseInt(decimals.toString()), symbol)
}

function parsePool({ fee, sqrtRatioX96, liquidity, tickCurrent, tokenIn, tokenOut }: V3PoolInRoute): Pool {
  return new Pool(
    parseToken(tokenIn),
    parseToken(tokenOut),
    parseInt(fee) as FeeAmount,
    sqrtRatioX96,
    liquidity,
    parseInt(tickCurrent)
  )
}

const parsePair = ({ reserve0, reserve1 }: V2PoolInRoute): Pair =>
  new Pair(
    CurrencyAmount.fromRawAmount(parseToken(reserve0.token), reserve0.quotient),
    CurrencyAmount.fromRawAmount(parseToken(reserve1.token), reserve1.quotient)
  )

// TODO(WEB-2050): Convert other instances of tradeType comparison to use this utility function
export function isExactInput(tradeType: TradeType): boolean {
  return tradeType === TradeType.EXACT_INPUT
}

export function currencyAddressForSwapQuote(currency: Currency): string {
  return (currency as any).address
}

export function isClassicTrade(trade?: InterfaceTrade): trade is ClassicTrade {
  return trade?.fillType === TradeFillType.Classic
}

export function isPreviewTrade(trade?: InterfaceTrade): trade is PreviewTrade {
  return trade?.fillType === TradeFillType.None
}

export function isSubmittableTrade(trade?: InterfaceTrade): trade is SubmittableTrade {
  return trade?.fillType === TradeFillType.Classic
}

export function isUniswapXTrade(trade?: InterfaceTrade) {
  return false
}
