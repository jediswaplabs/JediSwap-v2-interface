import { Protocol } from '@vnaysn/jediswap-router-sdk'
import { Currency, Percent, TradeType } from '@vnaysn/jediswap-sdk-core'
import { Pair } from '@vnaysn/jediswap-sdk-v2'
import { FeeAmount } from '@vnaysn/jediswap-sdk-v3'
import { ClassicTrade } from 'state/routing/types'

export interface RoutingDiagramEntry {
  percent: Percent
  path: [Currency, Currency, FeeAmount][]
  protocol: Protocol
  type: 'V1' | 'V2'
}

const V2_DEFAULT_FEE_TIER = 3000

/**
 * Loops through all routes on a trade and returns an array of diagram entries.
 */
export default function getRoutingDiagramEntries(trade: ClassicTrade): RoutingDiagramEntry[] {
  if (trade.swaps) {
    return trade.swaps.map(({ route, inputAmount, outputAmount }) => {
      const { pools, tokenPath, protocol } = route as any
      const portion =
        trade.tradeType === TradeType.EXACT_INPUT
          ? inputAmount.divide(trade.inputAmount)
          : outputAmount.divide(trade.outputAmount)
      const percent = new Percent(portion.numerator, portion.denominator)
      const path: RoutingDiagramEntry['path'] = []
      for (let i = 0; i < pools.length; i++) {
        const nextPool = pools[i]
        const tokenIn = tokenPath[i]
        const tokenOut = tokenPath[i + 1]
        const entry: RoutingDiagramEntry['path'][0] = [
          tokenIn,
          tokenOut,
          nextPool instanceof Pair ? V2_DEFAULT_FEE_TIER : nextPool.fee,
        ]
        path.push(entry)
      }
      return {
        percent,
        path,
        protocol,
        type: 'V2',
      }
    })
  } else {
    const { inputAmount, outputAmount } = trade
    const { pairs, path: tokenPath, protocol } = (trade as any).route
    const portion =
      trade.tradeType === TradeType.EXACT_INPUT ? inputAmount.divide(inputAmount) : outputAmount.divide(outputAmount)
    const percent = new Percent(portion.numerator, portion.denominator)
    const path: RoutingDiagramEntry['path'] = []
    for (let i = 0; i < pairs.length; i++) {
      const nextPool = pairs[i]
      const tokenIn = tokenPath[i]
      const tokenOut = tokenPath[i + 1]
      const entry: RoutingDiagramEntry['path'][0] = [
        tokenIn,
        tokenOut,
        nextPool instanceof Pair ? V2_DEFAULT_FEE_TIER : nextPool.fee,
      ]
      path.push(entry)
    }
    return [
      {
        percent,
        path,
        protocol,
        type: 'V1',
      },
    ]
  }
}
