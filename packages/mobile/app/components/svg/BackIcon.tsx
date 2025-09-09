import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalBackIcon from '../../assets/Back.svg';

const BackIcon: React.FC<SvgProps> = (props) => {
  return <OriginalBackIcon {...props} />;
};

export default BackIcon;