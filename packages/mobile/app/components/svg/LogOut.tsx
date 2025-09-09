import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalLogOutSvg from '../../assets/LogOut.svg';

const LogOut: React.FC<SvgProps> = (props) => {
  return <OriginalLogOutSvg {...props} />;
};

export default LogOut;