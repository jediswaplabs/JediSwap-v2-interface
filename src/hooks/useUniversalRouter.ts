/* eslint-disable */
// @ts-nocheck
import { BigNumber } from '@ethersproject/bignumber'
import { t } from '@lingui/macro'
import { CustomUserProperties, SwapEventName } from '@uniswap/analytics-events'
import { Percent } from '@vnaysn/jediswap-sdk-core'
import { FlatFeeOptions, SwapRouter } from '@vnaysn/jediswap-router-sdk'
import { FeeOptions, toHex } from '@vnaysn/jediswap-sdk-v3'
import { useAccountDetails } from 'hooks/starknet-react'
import { useCallback } from 'react'

import { sendAnalyticsEvent, useTrace } from 'analytics'
import { useCachedPortfolioBalancesQuery } from 'components/PrefetchBalancesWrapper/PrefetchBalancesWrapper'
import { getConnection } from 'connection'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { formatCommonPropertiesForTrade, formatSwapSignedAnalyticsEventProperties } from 'lib/utils/analytics'
import { ClassicTrade, TradeFillType } from 'state/routing/types'
import { useUserSlippageTolerance } from 'state/user/hooks'
import { calculateGasMargin } from 'utils/calculateGasMargin'
import { UserRejectedRequestError, WrongChainError } from 'utils/errors'
import isZero from 'utils/isZero'
import { didUserReject, swapErrorToUserReadableMessage } from 'utils/swapErrorToUserReadableMessage'
import { getWalletMeta } from 'utils/walletMeta'
import { PermitSignature } from './usePermitAllowance'
import { UNIVERSAL_ROUTER_ADDRESS } from 'constants/tokens'

/** Thrown when gas estimation fails. This class of error usually requires an emulator to determine the root cause. */
class GasEstimationError extends Error {
  constructor() {
    super(t`Your swap is expected to fail.`)
  }
}

/**
 * Thrown when the user modifies the transaction in-wallet before submitting it.
 * In-wallet calldata modification nullifies any safeguards (eg slippage) from the interface, so we recommend reverting them immediately.
 */
class ModifiedSwapError extends Error {
  constructor() {
    super(
      t`Your swap was modified through your wallet. If this was a mistake, please cancel immediately or risk losing your funds.`
    )
  }
}

interface SwapOptions {
  slippageTolerance: Percent
  deadline?: BigNumber
  permit?: PermitSignature
  feeOptions?: FeeOptions
  flatFeeOptions?: FlatFeeOptions
}

export function useUniversalRouterSwapCallback(
  trade: ClassicTrade | undefined,
  fiatValues: { amountIn?: number; amountOut?: number; feeUsd?: number },
  options: SwapOptions
) {
  const { account, chainId, provider, connector } = useAccountDetails()
  const analyticsContext = useTrace()
  const blockNumber = useBlockNumber()
  const isAutoSlippage = useUserSlippageTolerance()[0] === 'auto'
  const { data } = useCachedPortfolioBalancesQuery({ account })
  const portfolioBalanceUsd = data?.portfolios?.[0]?.tokensTotalDenominatedValue?.value

  return useCallback(async () => {
    try {
      if (!account) {
        throw new Error('missing account')
      }
      if (!chainId) {
        throw new Error('missing chainId')
      }
      if (!provider) {
        throw new Error('missing provider')
      }
      if (!trade) {
        throw new Error('missing trade')
      }

      // universal-router-sdk reconstructs V2Trade objects, so rather than updating the trade amounts to account for tax, we adjust the slippage tolerance as a workaround
      // TODO(WEB-2725): update universal-router-sdk to not reconstruct trades
      const taxAdjustedSlippageTolerance = options.slippageTolerance.add(trade.totalTaxRate)

      const { calldata: data, value } = SwapRouter.swapERC20CallParameters(trade, {
        slippageTolerance: taxAdjustedSlippageTolerance,
        deadlineOrPreviousBlockhash: options.deadline?.toString(),
        inputTokenPermit: options.permit,
        fee: options.feeOptions,
        flatFee: options.flatFeeOptions,
      })

      const tx = {
        from: account,
        to: UNIVERSAL_ROUTER_ADDRESS,
        data,
        // TODO(https://github.com/Uniswap/universal-router-sdk/issues/113): universal-router-sdk returns a non-hexlified value.
        ...(value && !isZero(value) ? { value: toHex(value) } : {}),
      }

      let gasEstimate: BigNumber
      try {
        gasEstimate = await provider.estimateGas(tx)
      } catch (gasError) {
        sendAnalyticsEvent(SwapEventName.SWAP_ESTIMATE_GAS_CALL_FAILED, {
          ...formatCommonPropertiesForTrade(trade, options.slippageTolerance),
          ...analyticsContext,
          client_block_number: blockNumber,
          tx,
          error: gasError,
          isAutoSlippage,
        })
        console.warn(gasError)
        throw new GasEstimationError()
      }
      const gasLimit = calculateGasMargin(gasEstimate)
      const beforeSign = Date.now()
      const response = await provider
        .getSigner()
        .sendTransaction({ ...tx, gasLimit })
        .then((response) => {
          sendAnalyticsEvent(SwapEventName.SWAP_SIGNED, {
            ...formatSwapSignedAnalyticsEventProperties({
              trade,
              timeToSignSinceRequestMs: Date.now() - beforeSign,
              allowedSlippage: options.slippageTolerance,
              fiatValues,
              txHash: response.hash,
              portfolioBalanceUsd,
            }),
            ...analyticsContext,
            // TODO (WEB-2993): remove these after debugging missing user properties.
            [CustomUserProperties.WALLET_ADDRESS]: account,
            [CustomUserProperties.WALLET_TYPE]: getConnection(connector).getName(),
            [CustomUserProperties.PEER_WALLET_AGENT]: provider ? getWalletMeta(provider)?.agent : undefined,
          })
          if (tx.data !== response.data) {
            sendAnalyticsEvent(SwapEventName.SWAP_MODIFIED_IN_WALLET, {
              txHash: response.hash,
              ...analyticsContext,
            })

            if (!response.data || response.data.length === 0 || response.data === '0x') {
              throw new ModifiedSwapError()
            }
          }
          return response
        })
      return {
        type: TradeFillType.Classic as const,
        response,
      }
    } catch (swapError: unknown) {
      if (swapError instanceof ModifiedSwapError) {
        throw swapError
      }

      // Cancellations are not failures, and must be accounted for as 'cancelled'.
      if (didUserReject(swapError)) {
        // This error type allows us to distinguish between user rejections and other errors later too.
        throw new UserRejectedRequestError(swapErrorToUserReadableMessage(swapError))
      }

      throw new Error(swapErrorToUserReadableMessage(swapError))
    }
  }, [
    account,
    chainId,
    provider,
    trade,
    options.slippageTolerance,
    options.deadline,
    options.permit,
    options.feeOptions,
    options.flatFeeOptions,
    analyticsContext,
    blockNumber,
    isAutoSlippage,
    fiatValues,
    portfolioBalanceUsd,
    connector,
  ])
}
