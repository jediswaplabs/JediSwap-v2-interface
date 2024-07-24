import { Text } from 'rebass';
import styled from 'styled-components';

import { MaxButton } from 'pages/Pool/styled';

export const Wrapper = styled.div`
  position: relative;
  padding: 20px;
  min-width: 460px;

  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToExtraSmall`
    min-width: 340px;
  `};
`;

export const SmallMaxButton = styled(MaxButton)`
  font-size: 12px;
  color: ${({ theme }) => theme.jediWhite};
  background: none;
  border-color: ${({ theme }) => theme.jediWhite};
`;

export const ResponsiveHeaderText = styled(Text)`
  font-size: 40px;
  font-weight: 535;
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToExtraSmall`
     font-size: 24px
  `};
`;
