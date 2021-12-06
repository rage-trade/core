import { expect } from 'chai';
import hre from 'hardhat';
import {
  VTokenPositionSetTest2,
  VPoolWrapper,
  UniswapV3Pool,
  AccountTest,
  RealTokenMock,
  ERC20,
  VBase,
  OracleMock,
  VPoolFactory,
  ClearingHouse,
} from '../typechain-types';
import { MockContract, FakeContract } from '@defi-wonderland/smock';
import { smock } from '@defi-wonderland/smock';
import { ConstantsStruct } from '../typechain-types/ClearingHouse';
import { testSetupBase, testSetupToken } from './utils/setup-general';
import { activateMainnetFork, deactivateMainnetFork } from './utils/mainnet-fork';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { tokenAmount } from './utils/stealFunds';

describe('Account Library Test - 2', () => {
  let VTokenPositionSet: MockContract<VTokenPositionSetTest2>;
  let vPoolFake: FakeContract<UniswapV3Pool>;
  let vPoolWrapperFake: FakeContract<VPoolWrapper>;
  let constants: ConstantsStruct;
  let vTokenAddress: string;
  let clearingHouse: ClearingHouse;
  let vPoolFactory: VPoolFactory;

  let test: AccountTest;
  let realBase: FakeContract<ERC20>;
  let vBase: FakeContract<VBase>;
  let oracle: OracleMock;

  let vBaseAddress: string;

  let ownerAddress: string;
  let testContractAddress: string;
  let oracleAddress: string;
  let realToken: RealTokenMock;

  let signers: SignerWithAddress[];

  async function checkTokenBalance(vTokenAddress: string, vTokenBalance: BigNumberish) {
    const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
    expect(vTokenPosition.balance).to.eq(vTokenBalance);
  }

  async function checkDepositBalance(vTokenAddress: string, vTokenBalance: BigNumberish) {
    const balance = await test.getAccountDepositBalance(vTokenAddress);
    expect(balance).to.eq(vTokenBalance);
  }

  async function checkLiquidityPositionNum(vTokenAddress: string, num: BigNumberish) {
    const outNum = await test.getAccountLiquidityPositionNum(vTokenAddress);
    expect(outNum).to.eq(num);
  }

  async function checkLiquidityPositionDetails(
    vTokenAddress: string,
    num: BigNumberish,
    tickLower?: BigNumberish,
    tickUpper?: BigNumberish,
    limitOrderType?: BigNumberish,
    liquidity?: BigNumberish,
    sumALast?: BigNumberish,
    sumBInsideLast?: BigNumberish,
    sumFpInsideLast?: BigNumberish,
    longsFeeGrowthInsideLast?: BigNumberish,
    shortsFeeGrowthInsideLast?: BigNumberish,
  ) {
    const out = await test.getAccountLiquidityPositionDetails(vTokenAddress, num);
    if (typeof tickLower !== 'undefined') expect(out.tickLower).to.eq(tickLower);
    if (typeof tickUpper !== 'undefined') expect(out.tickUpper).to.eq(tickUpper);
    if (typeof limitOrderType !== 'undefined') expect(out.limitOrderType).to.eq(limitOrderType);
    if (typeof liquidity !== 'undefined') expect(out.liquidity).to.eq(liquidity);
    if (typeof sumALast !== 'undefined') expect(out.sumALast).to.eq(sumALast);
    if (typeof sumBInsideLast !== 'undefined') expect(out.sumBInsideLast).to.eq(sumBInsideLast);
    if (typeof sumFpInsideLast !== 'undefined') expect(out.sumFpInsideLast).to.eq(sumFpInsideLast);
    if (typeof longsFeeGrowthInsideLast !== 'undefined')
      expect(out.longsFeeGrowthInsideLast).to.eq(longsFeeGrowthInsideLast);
    if (typeof shortsFeeGrowthInsideLast !== 'undefined')
      expect(out.shortsFeeGrowthInsideLast).to.eq(shortsFeeGrowthInsideLast);
  }

  before(async () => {
    await activateMainnetFork();
    let vPoolAddress;
    let vPoolWrapperAddress;

    ({
      realbase: realBase,
      vBase: vBase,
      clearingHouse: clearingHouse,
      vPoolFactory: vPoolFactory,
      constants: constants,
    } = await testSetupBase({
      isVTokenToken0: false,
    }));

    ({
      oracle: oracle,
      vTokenAddress: vTokenAddress,
      vPoolAddress: vPoolAddress,
      vPoolWrapperAddress: vPoolWrapperAddress,
    } = await testSetupToken({
      decimals: 18,
      initialMarginRatio: 20000,
      maintainanceMarginRatio: 10000,
      twapDuration: 60,
      vPoolFactory: vPoolFactory,
    }));

    vBaseAddress = vBase.address;

    vPoolFake = await smock.fake<UniswapV3Pool>('IUniswapV3Pool', {
      address: vPoolAddress,
    });
    vPoolFake.observe.returns([[0, 194430 * 60], []]);

    vPoolWrapperFake = await smock.fake<VPoolWrapper>('VPoolWrapper', {
      address: vPoolWrapperAddress,
    });
    vPoolWrapperFake.timeHorizon.returns(60);
    vPoolWrapperFake.maintainanceMarginRatio.returns(10000);
    vPoolWrapperFake.initialMarginRatio.returns(20000);

    const factory = await hre.ethers.getContractFactory('AccountTest');
    test = await factory.deploy();

    vPoolWrapperFake.swapToken.returns((input: any) => {
      if (input.isNotional) {
        return [input.amount / 4000, -input.amount];
      } else {
        return [input.amount, -4000 * input.amount];
      }
    });

    vPoolWrapperFake.liquidityChange.returns((input: any) => {
      return [-input.liquidity * 4000, -input.liquidity];
    });
  });
  after(deactivateMainnetFork);
  describe('#Initialize', () => {
    it('Init', async () => {
      test.initToken(vTokenAddress);
    });
  });

  describe('#Margin', () => {
    it('Add Margin', async () => {
      await test.addMargin(vBaseAddress, '10000000000', constants);
      await checkDepositBalance(vBaseAddress, '10000000000');
    });

    it('Remove Margin', async () => {
      await test.removeMargin(vBaseAddress, '50', 0, constants);
      await checkDepositBalance(vBaseAddress, '9999999950');
    });
  });

  describe('#Trades', () => {
    before(async () => {});
    it('Swap Token (Token Amount)', async () => {
      await test.swapTokenAmount(vTokenAddress, '10', 0, constants);
      await checkTokenBalance(vTokenAddress, '10');
      await checkTokenBalance(vBaseAddress, -40000);
    });

    it('Swap Token (Token Notional)', async () => {
      await test.swapTokenNotional(vTokenAddress, '40000', 0, constants);
      await checkTokenBalance(vTokenAddress, '20');
      await checkTokenBalance(vBaseAddress, -80000);
    });

    it('Liqudity Change', async () => {
      await test.cleanPositions(constants);
      await checkTokenBalance(vTokenAddress, '0');

      await test.liquidityChange(vTokenAddress, -100, 100, 5, 0, 0, constants);
      await checkTokenBalance(vTokenAddress, '-5');
      await checkTokenBalance(vBaseAddress, -20000);
      await checkLiquidityPositionNum(vTokenAddress, 1);
      await checkLiquidityPositionDetails(vTokenAddress, 0, -100, 100, 0, 5);
    });
  });

  describe('#Remove Limit Order', () => {
    describe('Not limit order', () => {
      before(async () => {
        await test.cleanPositions(constants);
        await test.liquidityChange(vTokenAddress, 194000, 195000, 5, 0, 0, constants);
        await checkTokenBalance(vTokenAddress, '-5');
        await checkTokenBalance(vBaseAddress, -20000);
        await checkLiquidityPositionNum(vTokenAddress, 1);
        await checkLiquidityPositionDetails(vTokenAddress, 0, 194000, 195000, 0, 5);
      });
      it('Remove Failure - Inside Range (No Limit)', async () => {
        vPoolFake.observe.returns([[0, 194500 * 60], []]);
        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, 90, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Below Range (No Limit)', async () => {
        vPoolFake.observe.returns([[0, 193500 * 60], []]);
        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, -110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Above Range (No Limit)', async () => {
        vPoolFake.observe.returns([[0, 195500 * 60], []]);
        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, 110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
    });
    describe('Lower limit order', () => {
      before(async () => {
        await test.cleanPositions(constants);
        await test.liquidityChange(vTokenAddress, 194000, 195000, 5, 1, 0, constants);
        await checkTokenBalance(vTokenAddress, '-5');
        await checkTokenBalance(vBaseAddress, -20000);
        await checkLiquidityPositionNum(vTokenAddress, 1);
        await checkLiquidityPositionDetails(vTokenAddress, 0, 194000, 195000, 1, 5);
      });
      it('Remove Failure - Inside Range (Lower Limit)', async () => {
        vPoolFake.observe.returns([[0, 194500 * 60], []]);
        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, 90, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Above Range (Lower Limit)', async () => {
        vPoolFake.observe.returns([[0, 195500 * 60], []]);
        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, 110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Success - Below Range (Lower Limit)', async () => {
        vPoolFake.observe.returns([[0, 193500 * 60], []]);
        test.removeLimitOrder(vTokenAddress, 194000, 195000, -110, constants);
        await checkTokenBalance(vTokenAddress, 0);
        await checkTokenBalance(vBaseAddress, 0);
        await checkLiquidityPositionNum(vTokenAddress, 0);
      });
    });
    describe('Upper limit order', () => {
      before(async () => {
        await test.cleanPositions(constants);
        await test.liquidityChange(vTokenAddress, 194000, 195000, 5, 2, 0, constants);
        await checkTokenBalance(vTokenAddress, '-5');
        await checkTokenBalance(vBaseAddress, -20000);
        await checkLiquidityPositionNum(vTokenAddress, 1);
        await checkLiquidityPositionDetails(vTokenAddress, 0, 194000, 195000, 2, 5);
      });
      it('Remove Failure - Inside Range (Upper Limit)', async () => {
        vPoolFake.observe.returns([[0, 194500 * 60], []]);

        vPoolFake.observe.returns([[0, 194430 * 60], []]);
        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, 90, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Below Range (Upper Limit)', async () => {
        vPoolFake.observe.returns([[0, 193500 * 60], []]);

        expect(test.removeLimitOrder(vTokenAddress, 194000, 195000, -110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Success - Above Range (Upper Limit)', async () => {
        vPoolFake.observe.returns([[0, 195500 * 60], []]);

        test.removeLimitOrder(vTokenAddress, 194000, 195000, 110, constants);
        await checkTokenBalance(vTokenAddress, 0);
        await checkTokenBalance(vBaseAddress, 0);
        await checkLiquidityPositionNum(vTokenAddress, 0);
      });
    });
  });

  describe('#Liquidation', () => {
    it('Liquidate Liquidity Positions - Fail', async () => {
      expect(test.liquidateLiquidityPositions(tokenAmount(10, 6), 150, 5000, 0, constants)).to.be.reverted; // feeFraction=15/10=1.5
    });
    it('Liquidate Token Positions - Fail', async () => {
      expect(test.liquidateTokenPosition(vTokenAddress, tokenAmount(10, 6), 5000, 150, 5000, 0, constants)).to.be
        .reverted;
    });
  });
});
