import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCartSvg from '../../assets/Cart.svg';
import CartDarkSvg from '../../assets/CartDark.svg';
import { useTheme } from '../../lib/ThemeContext';

const Cart: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === 'dark' ? <CartDarkSvg {...props} /> : <OriginalCartSvg {...props} />;
};

export default Cart;
