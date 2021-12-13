import hre from 'hardhat';
import { TickTest, UniswapV3PoolMock } from '../typechain-types';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { expect } from 'chai';
import { Q128, toQ128 } from './utils/fixed-point';
import { constants } from './utils/dummyConstants';
import { InfoStruct } from '../typechain-types/TickTest';

describe('Tick', () => {
  let test: TickTest;
  let vPool: UniswapV3PoolMock;
  beforeEach(async () => {
    test = await (await hre.ethers.getContractFactory('TickTest')).deploy();
    vPool = await hre.ethers.getContractAt('UniswapV3PoolMock', await test.vPool());
  });

  describe('#fundingPaymentGrowthInside', () => {
    it('zero', async () => {
      await setGlobal({ sumAX128: 0, sumFpX128: 0 });
      expect(await test.getFundingPaymentGrowthInside(-1, 1, 0)).to.eq(0);
    });

    it('current price inside, global increase', async () => {
      await setGlobal({ sumAX128: 0, sumFpX128: toQ128(10) });
      expect(await test.getFundingPaymentGrowthInside(-1, 1, 0)).to.eq(toQ128(10));
    });

    it('current price outside, global increase', async () => {
      await setGlobal({ sumAX128: 0, sumFpX128: toQ128(10) });
      expect(await test.getFundingPaymentGrowthInside(-1, 1, 2)).to.eq(0);
    });

    it('current price inside, global increase with ticks', async () => {
      await setGlobal({ sumAX128: 0, sumFpX128: toQ128(30) });
      await setTick(-1, { sumFpOutsideX128: toQ128(5) });
      await setTick(1, { sumFpOutsideX128: toQ128(10) });
      expect(await test.getFundingPaymentGrowthInside(-1, 1, 0)).to.eq(toQ128(15));
    });

    it('current price outside, global increase with ticks', async () => {
      await setGlobal({ sumAX128: 0, sumFpX128: toQ128(30) });
      await setTick(-1, { sumFpOutsideX128: toQ128(5) });
      await setTick(1, { sumFpOutsideX128: toQ128(10) });
      expect(await test.getFundingPaymentGrowthInside(-1, 1, 2)).to.eq(toQ128(5));
    });

    it('current price outside, global increase with ticks and extrapolation', async () => {
      await setGlobal({ sumAX128: toQ128(10), sumFpX128: toQ128(30) });
      await setTick(-1, { sumFpOutsideX128: toQ128(5) });
      await setTick(1, { sumFpOutsideX128: toQ128(10), sumBOutsideX128: toQ128(10) });
      // extrapolated fp in -1 to 1 would be 10x10 = 100
      expect(await test.getFundingPaymentGrowthInside(-1, 1, 2)).to.eq(toQ128(100 + 5));
    });
  });

  const vTokenAddress = {
    suchThatVTokenIsToken0: ethers.utils.hexZeroPad(BigNumber.from(1).toHexString(), 20),
    suchThatVTokenIsToken1: BigNumber.from(1).shl(160).sub(1).toHexString(),
  };
  describe('#uniswapFeeGrowth', () => {
    it('zero', async () => {
      expect(await test.getUniswapFeeGrowthInside(-1, 1, 0, vTokenAddress.suchThatVTokenIsToken0, constants)).to.eq(0);
    });

    it('current price inside, global increase', async () => {
      await vPool.setFeeGrowth(0, toQ128(10)); // increasing token1 global var
      expect(await test.getUniswapFeeGrowthInside(-1, 1, 0, vTokenAddress.suchThatVTokenIsToken0, constants)).to.eq(
        toQ128(10),
      );
    });

    it('current price outside, global increase', async () => {
      await vPool.setFeeGrowth(0, toQ128(10)); // increasing token1 global var
      expect(await test.getUniswapFeeGrowthInside(-1, 1, 2, vTokenAddress.suchThatVTokenIsToken0, constants)).to.eq(0);
    });

    it('current price inside, global increase with ticks', async () => {
      await vPool.setFeeGrowth(0, toQ128(30)); // increasing token1 global var
      await vPoolMocksetTick(-1, { feeGrowthOutside1X128: toQ128(5) });
      await vPoolMocksetTick(1, { feeGrowthOutside1X128: toQ128(10) });
      expect(await test.getUniswapFeeGrowthInside(-1, 1, 0, vTokenAddress.suchThatVTokenIsToken0, constants)).to.eq(
        toQ128(15),
      );
    });

    it('current price outside, global increase with ticks', async () => {
      await vPool.setFeeGrowth(0, 30); // increasing token1 global var
      await vPoolMocksetTick(-1, { feeGrowthOutside1X128: toQ128(5) });
      await vPoolMocksetTick(1, { feeGrowthOutside1X128: toQ128(10) });
      expect(await test.getUniswapFeeGrowthInside(-1, 1, 2, vTokenAddress.suchThatVTokenIsToken0, constants)).to.eq(
        toQ128(5),
      );
    });
  });

  describe('#extendedFeeGrowth', () => {
    it('zero', async () => {
      expect(await test.getExtendedFeeGrowthInside(-1, 1, 0)).to.eq(0);
    });

    it('current price inside, global increase', async () => {
      await test.setExtendedFeeGrowthOutsideX128(toQ128(10));
      expect(await test.getExtendedFeeGrowthInside(-1, 1, 0)).to.eq(toQ128(10));
    });

    it('current price outside, global increase', async () => {
      await test.setExtendedFeeGrowthOutsideX128(toQ128(10));
      expect(await test.getExtendedFeeGrowthInside(-1, 1, 2)).to.eq(0);
    });

    it('current price inside, global increase with ticks', async () => {
      await test.setExtendedFeeGrowthOutsideX128(toQ128(30));
      await setTick(-1, { sumExFeeOutsideX128: toQ128(5) });
      await setTick(1, { sumExFeeOutsideX128: toQ128(10) });
      expect(await test.getExtendedFeeGrowthInside(-1, 1, 0)).to.eq(toQ128(15));
    });

    it('current price outside, global increase with ticks', async () => {
      await test.setExtendedFeeGrowthOutsideX128(toQ128(30));
      await setTick(-1, { sumExFeeOutsideX128: toQ128(5) });
      await setTick(1, { sumExFeeOutsideX128: toQ128(10) });
      expect(await test.getExtendedFeeGrowthInside(-1, 1, 2)).to.eq(toQ128(5));
    });
  });

  describe('#cross', () => {
    it('first cross', async () => {
      await registerTrade({
        tokenAmount: 100,
        liquidity: 10000,
        blockTimestamp: 1,
      });
      await test.cross(1);
      const fpGlobal = await test.fpGlobal();
      const tick = await test.extendedTicks(1);
      expect(tick.sumALastX128).to.eq(fpGlobal.sumAX128);
      expect(tick.sumBOutsideX128).to.eq(fpGlobal.sumBX128);
      expect(tick.sumFpOutsideX128).to.eq(fpGlobal.sumFpX128);
      expect(tick.sumExFeeOutsideX128).to.eq(await test.sumExFeeGlobalX128());
    });

    it('second cross', async () => {
      await registerTrade({
        tokenAmount: 100,
        liquidity: 10000,
        blockTimestamp: 1,
      });
      const fpGlobal1 = await test.fpGlobal();
      const extendedFee1 = await test.sumExFeeGlobalX128();
      await test.cross(1);

      await registerTrade({
        tokenAmount: 200,
        liquidity: 5000,
        blockTimestamp: 3,
      });
      const fpGlobal2 = await test.fpGlobal();
      const extendedFee2 = await test.sumExFeeGlobalX128();
      await test.cross(2);

      const tick = await test.extendedTicks(2);
      expect(tick.sumALastX128).to.eq(fpGlobal2.sumAX128);
      expect(tick.sumBOutsideX128).to.eq(fpGlobal2.sumBX128);
      expect(tick.sumFpOutsideX128).to.eq(fpGlobal2.sumFpX128);
      expect(tick.sumExFeeOutsideX128).to.eq(extendedFee2);

      expect(await test.getNetPositionInside(1, 2, 3)).to.eq(fpGlobal2.sumBX128.sub(fpGlobal1.sumBX128));
      expect(await test.getFundingPaymentGrowthInside(1, 2, 3)).to.eq(
        fpGlobal2.sumFpX128.sub(
          fpGlobal1.sumFpX128.add(fpGlobal1.sumBX128.mul(fpGlobal2.sumAX128.sub(fpGlobal1.sumAX128)).div(Q128)),
        ),
      );

      expect(await test.getExtendedFeeGrowthInside(1, 2, 3)).to.eq(extendedFee2.sub(extendedFee1));
    });
  });

  async function setGlobal({
    sumAX128,
    sumBX128,
    sumFpX128,
    sumExFeeX128,
  }: {
    sumAX128?: BigNumberish;
    sumBX128?: BigNumberish;
    sumFpX128?: BigNumberish;
    sumExFeeX128?: BigNumberish;
  }) {
    const fpGlobal = await test.fpGlobal();
    const sumExFeeGlobalX128 = await test.sumExFeeGlobalX128();
    if (sumAX128 === undefined) sumAX128 = fpGlobal.sumAX128;
    if (sumBX128 === undefined) sumBX128 = fpGlobal.sumBX128;
    if (sumFpX128 === undefined) sumFpX128 = fpGlobal.sumFpX128;
    if (sumExFeeX128 === undefined) sumExFeeX128 = sumExFeeGlobalX128;
    test.setFpGlobal({ sumAX128, sumBX128, sumFpX128, timestampLast: 0 });
    await test.setExtendedFeeGrowthOutsideX128(sumExFeeX128);
  }

  async function setTick(
    tickIndex: number,
    {
      sumALastX128,
      sumBOutsideX128,
      sumFpOutsideX128,
      sumExFeeOutsideX128,
    }: {
      sumALastX128?: BigNumberish;
      sumBOutsideX128?: BigNumberish;
      sumFpOutsideX128?: BigNumberish;
      sumExFeeOutsideX128?: BigNumberish;
    },
  ) {
    const tick = await test.extendedTicks(tickIndex);
    if (sumALastX128 === undefined) sumALastX128 = tick.sumALastX128;
    if (sumBOutsideX128 === undefined) sumBOutsideX128 = tick.sumBOutsideX128;
    if (sumFpOutsideX128 === undefined) sumFpOutsideX128 = tick.sumFpOutsideX128;
    if (sumExFeeOutsideX128 === undefined) sumExFeeOutsideX128 = tick.sumExFeeOutsideX128;
    // @ts-ignore bug in typechain structs
    await test.setTick(tickIndex, [sumALastX128, sumBOutsideX128, sumFpOutsideX128, sumExFeeOutsideX128]);
  }

  async function vPoolMocksetTick(
    tickIndex: number,
    {
      liquidityGross,
      liquidityNet,
      feeGrowthOutside0X128,
      feeGrowthOutside1X128,
      tickCumulativeOutside,
      secondsPerLiquidityOutsideX128,
      secondsOutside,
      initialized,
    }: {
      liquidityGross?: BigNumberish;
      liquidityNet?: BigNumberish;
      feeGrowthOutside0X128?: BigNumberish;
      feeGrowthOutside1X128?: BigNumberish;
      tickCumulativeOutside?: BigNumberish;
      secondsPerLiquidityOutsideX128?: BigNumberish;
      secondsOutside?: BigNumberish;
      initialized?: boolean;
    },
  ) {
    const tick = await vPool.ticks(tickIndex);
    if (liquidityGross === undefined) liquidityGross = tick.liquidityGross;
    if (liquidityNet === undefined) liquidityNet = tick.liquidityNet;
    if (feeGrowthOutside0X128 === undefined) feeGrowthOutside0X128 = tick.feeGrowthOutside0X128;
    if (feeGrowthOutside1X128 === undefined) feeGrowthOutside1X128 = tick.feeGrowthOutside1X128;
    if (tickCumulativeOutside === undefined) tickCumulativeOutside = tick.tickCumulativeOutside;
    if (secondsPerLiquidityOutsideX128 === undefined)
      secondsPerLiquidityOutsideX128 = tick.secondsPerLiquidityOutsideX128;
    if (secondsOutside === undefined) secondsOutside = tick.secondsOutside;
    if (initialized === undefined) initialized = tick.initialized;
    await vPool.setTick(
      tickIndex,
      liquidityGross,
      liquidityNet,
      feeGrowthOutside0X128,
      feeGrowthOutside1X128,
      tickCumulativeOutside,
      secondsPerLiquidityOutsideX128,
      secondsOutside,
      initialized,
    );
  }

  async function registerTrade({
    tokenAmount,
    liquidity,
    blockTimestamp,
    realPrice,
    virtualPrice,
  }: {
    tokenAmount: BigNumberish;
    liquidity: BigNumberish;
    blockTimestamp: BigNumberish;
    realPrice?: number;
    virtualPrice?: number;
  }) {
    await test.registerTrade(
      tokenAmount,
      liquidity,
      blockTimestamp,
      toQ128(realPrice ?? 1.01),
      toQ128(virtualPrice ?? 1),
    );
  }
});
