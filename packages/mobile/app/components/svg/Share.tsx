import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalShareSvg from '../../assets/Share.svg';

const Share: React.FC<SvgProps> = (props) => {
  return <OriginalShareSvg {...props} />;
};

export default Share;
