import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalCartSvg from '../../assets/Cart.svg';

const Cart: React.FC<SvgProps> = (props) => {
  return <OriginalCartSvg {...props} />;
};

export default Cart;