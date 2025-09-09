import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCheckIcon from '../../assets/Check.svg';

const CheckIcon: React.FC<SvgProps> = (props) => {
  return <OriginalCheckIcon {...props} />;
};

export default CheckIcon;