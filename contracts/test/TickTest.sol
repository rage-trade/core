//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import { FundingPayment } from '../libraries/FundingPayment.sol';
import { Tick } from '../libraries/Tick.sol';
import { VTokenAddress, VTokenLib } from '../libraries/VTokenLib.sol';

import { UniswapV3PoolMock } from './mocks/UniswapV3PoolMock.sol';

import { IUniswapV3Pool } from '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import { Constants } from '../utils/Constants.sol';

contract TickTest {
    using FundingPayment for FundingPayment.Info;
    using Tick for mapping(int24 => Tick.Info);
    using Tick for IUniswapV3Pool;
    using VTokenLib for VTokenAddress;

    mapping(int24 => Tick.Info) public extendedTicks;

    FundingPayment.Info public fpGlobal;
    uint256 public sumExFeeGlobalX128;

    IUniswapV3Pool public vPool;

    constructor() {
        vPool = IUniswapV3Pool(address(new UniswapV3PoolMock()));
    }

    function setTick(int24 tickIndex, Tick.Info memory tick) external {
        extendedTicks[tickIndex] = tick;
    }

    function setFpGlobal(FundingPayment.Info calldata fpGlobal_) external {
        fpGlobal = fpGlobal_;
    }

    function setExtendedFeeGrowthOutsideX128(uint256 _extendedFeeGrowthOutsideX128) external {
        sumExFeeGlobalX128 = _extendedFeeGrowthOutsideX128;
    }

    function getNetPositionInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent
    ) public view returns (int256 netPositionGrowthX128) {
        (netPositionGrowthX128, , ) = extendedTicks.getExtendedTickStateInside(
            tickLower,
            tickUpper,
            tickCurrent,
            fpGlobal,
            sumExFeeGlobalX128
        );
    }

    function getFundingPaymentGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent
    ) public view returns (int256 fundingPaymentGrowth) {
        (, fundingPaymentGrowth, ) = extendedTicks.getExtendedTickStateInside(
            tickLower,
            tickUpper,
            tickCurrent,
            fpGlobal,
            sumExFeeGlobalX128
        );
    }

    function getUniswapFeeGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        VTokenAddress vToken,
        Constants memory constants
    ) public view returns (uint256 uniswapFeeGrowthInside) {
        return vPool.getUniswapFeeGrowthInside(tickLower, tickUpper, tickCurrent, vToken.isToken0(constants));
    }

    function getExtendedFeeGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent
    ) public view returns (uint256 extendedFeeGrowthInside) {
        (, , extendedFeeGrowthInside) = extendedTicks.getExtendedTickStateInside(
            tickLower,
            tickUpper,
            tickCurrent,
            fpGlobal,
            sumExFeeGlobalX128
        );
    }

    function registerTrade(
        int256 tokenAmount,
        uint256 liquidity,
        uint48 blockTimestamp,
        uint256 realPriceX128,
        uint256 virtualPriceX128
    ) public {
        fpGlobal.update(tokenAmount, liquidity, blockTimestamp, realPriceX128, virtualPriceX128);
    }

    function cross(int24 tickNext) external {
        extendedTicks.cross(tickNext, fpGlobal, sumExFeeGlobalX128);
    }
}
