import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCart2Svg from '../../assets/Cart2.svg';
import Cart2DarkSvg from '../../assets/Cart2Dark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Cart2: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <Cart2DarkSvg {...props} /> : <OriginalCart2Svg {...props} />;
};

export default Cart2;
