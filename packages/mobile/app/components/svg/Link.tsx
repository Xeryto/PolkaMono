import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLinkSvg from '../../assets/Link.svg';

const Link: React.FC<SvgProps> = (props) => {
  return <OriginalLinkSvg {...props} />;
};

export default Link;
