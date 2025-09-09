import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalVKSvg from '../../assets/VK.svg';

const VK: React.FC<SvgProps> = (props) => {
  return <OriginalVKSvg {...props} />;
};

export default VK;