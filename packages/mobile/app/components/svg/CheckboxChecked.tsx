import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCheckboxCheckedSvg from '../../assets/CheckboxChecked.svg';

const CheckboxChecked: React.FC<SvgProps> = (props) => {
  return <OriginalCheckboxCheckedSvg {...props} />;
};

export default CheckboxChecked;