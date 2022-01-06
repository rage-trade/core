//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import { FullMath } from '@uniswap/v3-core-0.8-support/contracts/libraries/FullMath.sol';
import { FixedPoint96 } from '@uniswap/v3-core-0.8-support/contracts/libraries/FixedPoint96.sol';
import { TickMath } from '@uniswap/v3-core-0.8-support/contracts/libraries/TickMath.sol';

library PriceMath {
    using FullMath for uint256;

    error IllegalSqrtPrice(uint160 sqrtPriceX96);

    // TODO remove this if not needed
    // function toSqrtPriceX96(uint256 priceX128) internal pure returns (uint160 sqrtPriceX96) {}

    function toPriceX128(uint160 sqrtPriceX96) internal pure returns (uint256 priceX128) {
        if (sqrtPriceX96 < TickMath.MIN_SQRT_RATIO || sqrtPriceX96 >= TickMath.MAX_SQRT_RATIO) {
            revert IllegalSqrtPrice(sqrtPriceX96);
        }

        // computing the square
        priceX128 = uint256(sqrtPriceX96).mulDiv(sqrtPriceX96, 1 << 64);
    }
}
