import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalMoreSvg from '../../assets/More.svg';

const More: React.FC<SvgProps> = (props) => {
  return <OriginalMoreSvg {...props} />;
};

export default More;