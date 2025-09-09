import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalPlusSvg from '../../assets/Plus.svg';

const PlusSvg: React.FC<SvgProps> = (props) => {
  return <OriginalPlusSvg {...props} />;
};

export default PlusSvg;