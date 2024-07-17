import { Trans } from '@lingui/macro'
import { FeeAmount } from '@harshalmaniya/jediswap-sdk-v3'
import React from 'react'
import styled from 'styled-components'

import { ButtonRadioChecked } from 'components/Button'
import { AutoColumn } from 'components/Column'
import { useFeeTierDistribution } from 'hooks/useFeeTierDistribution'
import { PoolState } from 'hooks/usePools'
import { ThemedText } from 'theme/components'
import { FeeTierPercentageBadge } from './FeeTierPercentageBadge'
import { FEE_AMOUNT_DETAIL } from './shared'

const ResponsiveText = styled(ThemedText.DeprecatedLabel)`
  line-height: 16px;
  font-size: 14px;

  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToSmall`
    font-size: 12px;
    line-height: 12px;
  `};
`

interface FeeOptionProps {
  feeAmount: FeeAmount
  active: boolean
  distributions: ReturnType<typeof useFeeTierDistribution>['distributions']
  poolState: PoolState
  onClick: () => void
}

export function FeeOption({ feeAmount, active, poolState, distributions, onClick }: FeeOptionProps) {
  return (
    <ButtonRadioChecked active={active} onClick={onClick} style={{ border: '1px solid #444', borderRadius: '8px' }}>
      <AutoColumn gap="sm" justify="flex-start">
        <AutoColumn justify="flex-start" gap="6px">
          <ResponsiveText>
            <Trans>{FEE_AMOUNT_DETAIL[feeAmount].label}%</Trans>
          </ResponsiveText>
          <ThemedText.DeprecatedMain fontWeight={485} fontSize="12px" textAlign="left">
            {FEE_AMOUNT_DETAIL[feeAmount].description}
          </ThemedText.DeprecatedMain>
        </AutoColumn>

        {/*  {distributions && (
          <FeeTierPercentageBadge distributions={distributions} feeAmount={feeAmount} poolState={poolState} />
        )} */}
      </AutoColumn>
    </ButtonRadioChecked>
  )
}
