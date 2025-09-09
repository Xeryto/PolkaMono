import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCheckboxUncheckedSvg from '../../assets/CheckboxUnchecked.svg';

const CheckboxUnchecked: React.FC<SvgProps> = (props) => {
  return <OriginalCheckboxUncheckedSvg {...props} />;
};

export default CheckboxUnchecked;