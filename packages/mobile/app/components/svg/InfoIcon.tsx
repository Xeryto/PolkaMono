import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalInfoIconSvg from '../../assets/InfoIcon.svg';

const InfoIcon: React.FC<SvgProps> = (props) => {
  return <OriginalInfoIconSvg {...props} />;
};

export default InfoIcon;