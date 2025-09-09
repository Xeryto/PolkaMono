import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCancelSvg from '../../assets/Cancel.svg';

const Cancel: React.FC<SvgProps> = (props) => {
  return <OriginalCancelSvg {...props} />;
};

export default Cancel;