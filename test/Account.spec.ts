import { expect } from 'chai';
import hre from 'hardhat';
import { network } from 'hardhat';

import { utils } from 'ethers';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';

import { activateMainnetFork, deactivateMainnetFork } from './utils/mainnet-fork';

import { AccountTest, ClearingHouse, ERC20, RealTokenMock } from '../typechain-types';
import { ConstantsStruct } from '../typechain-types/ClearingHouse';
import { UNISWAP_FACTORY_ADDRESS, DEFAULT_FEE_TIER, POOL_BYTE_CODE_HASH } from './utils/realConstants';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { config } from 'dotenv';
import { smock } from '@defi-wonderland/smock';
config();
const { ALCHEMY_KEY } = process.env;

describe('AccountTest Library', () => {
  let test: AccountTest;

  let vTokenAddress: string;
  let vBaseAddress: string;
  let ownerAddress: string;
  let testContractAddress: string;
  let oracleAddress: string;
  let realToken: RealTokenMock;
  let constants: ConstantsStruct;

  let signers: SignerWithAddress[];

  async function deployPool(
    clearingHouse: ClearingHouse,
    initialMargin: BigNumberish,
    maintainanceMargin: BigNumberish,
    twapDuration: BigNumberish,
  ) {
    await clearingHouse.initializePool(
      'vWETH',
      'vWETH',
      realToken.address,
      oracleAddress,
      initialMargin,
      maintainanceMargin,
      twapDuration,
    );

    const eventFilter = clearingHouse.filters.poolInitlized();
    const events = await clearingHouse.queryFilter(eventFilter, 'latest');
    const vPool = events[0].args[0];
    vTokenAddress = events[0].args[1];
    const vPoolWrapper = events[0].args[2];

    // console.log('VBASE ADDRESS: ', vBaseAddress);
    // console.log('Wrapper Address: ', vPoolWrapper);
    // console.log('Clearing House Address: ', clearingHouse.address);
    // console.log('Oracle Address: ', oracleAddress);
  }

  before(async () => {
    await activateMainnetFork();

    const rBase = await smock.fake<ERC20>('ERC20');
    rBase.decimals.returns(18);
    const vBaseFactory = await hre.ethers.getContractFactory('VBase');
    const vBase = await vBaseFactory.deploy(rBase.address);
    vBaseAddress = vBase.address;

    const oracleFactory = await hre.ethers.getContractFactory('OracleMock');
    const oracle = await oracleFactory.deploy();
    oracleAddress = oracle.address;

    const clearingHouseFactory = await hre.ethers.getContractFactory('ClearingHouse');
    const clearingHouse = await clearingHouseFactory.deploy(
      vBaseAddress,
      UNISWAP_FACTORY_ADDRESS,
      DEFAULT_FEE_TIER,
      POOL_BYTE_CODE_HASH,
    );

    await vBase.transferOwnership(clearingHouse.address);

    const realTokenFactory = await hre.ethers.getContractFactory('RealTokenMock');
    realToken = await realTokenFactory.deploy();

    await deployPool(clearingHouse, 20, 10, 1);

    const factory = await hre.ethers.getContractFactory('AccountTest');
    test = await factory.deploy();

    signers = await hre.ethers.getSigners();
    const tester = signers[0];
    ownerAddress = await tester.getAddress();
    testContractAddress = test.address;

    constants = await clearingHouse.constants();
  });

  after(async () => {
    await deactivateMainnetFork();
  });

  describe('#Initialize', () => {
    it('Init', async () => {
      test.initToken(vTokenAddress);
    });

    it('Mint', async () => {
      await realToken.mint(ownerAddress, '10000');
      await realToken.approve(testContractAddress, '10000');
    });
  });

  describe('#Margin', () => {
    it('Add Margin', async () => {
      await test.addMargin(vTokenAddress, '100', constants);
      expect(await realToken.balanceOf(ownerAddress)).to.eq('9900');
      expect(await realToken.balanceOf(testContractAddress)).to.eq('100');
      expect(await test.getAccountDepositBalance(vTokenAddress)).to.eq('100');
    });

    it('Remove Margin', async () => {
      await test.removeMargin(vTokenAddress, '50', constants);
      expect(await realToken.balanceOf(ownerAddress)).to.eq('9950');
      expect(await realToken.balanceOf(testContractAddress)).to.eq('50');
      expect(await test.getAccountDepositBalance(vTokenAddress)).to.eq('50');
    });
  });

  describe('#Trades', () => {
    it('Swap Token (Token Amount)', async () => {
      await test.swapTokenAmount(vTokenAddress, '10', constants);
      const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
      const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
      expect(vTokenPosition[0]).to.eq('10');
      expect(vBasePosition[0]).to.eq(-40000);
    });

    it('Swap Token (Token Notional)', async () => {
      await test.swapTokenNotional(vTokenAddress, '40000', constants);
      const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
      const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
      expect(vTokenPosition[0]).to.eq('20');
      expect(vBasePosition[0]).to.eq(-80000);
    });

    it('Liqudity Change', async () => {
      await test.liquidityChange(vTokenAddress, -100, 100, 5, 0, constants);
      const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
      const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
      expect(vTokenPosition[0]).to.eq('15');
      expect(vBasePosition[0]).to.eq(-100000);
    });
  });

  describe('#Liquidation', () => {
    it('Liquidate Liquidity Positions');
    // , async () => {
    //   await test.liquidateLiquidityPositions(15, constants); // feeFraction=15/10=1.5
    // });
    it('Liquidate Token Positions');
    // , async () => {
    //   await test.liquidateTokenPosition(vTokenAddress, 5000, 50, 15, 5);
    // });
  });

  describe('#Remove Limit Order', () => {
    describe('Not limit order', () => {
      before(async () => {
        await test.cleanPositions(constants);
        await test.liquidityChange(vTokenAddress, -100, 100, 5, 0, constants);
        const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
        const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
        expect(vTokenPosition[0]).to.eq(-5);
        expect(vBasePosition[0]).to.eq(-20000);
      });
      it('Remove Failure - Inside Range (No Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, 90, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Below Range (No Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, -110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Above Range (No Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, 110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
    });
    describe('Lower limit order', () => {
      before(async () => {
        await test.cleanPositions(constants);
        await test.liquidityChange(vTokenAddress, -100, 100, 5, 1, constants);
        const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
        const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
        expect(vTokenPosition[0]).to.eq(-5);
        expect(vBasePosition[0]).to.eq(-20000);
      });
      it('Remove Failure - Inside Range (Lower Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, 90, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Above Range (Lower Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, 110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Success - Below Range (Lower Limit)', async () => {
        test.removeLimitOrder(vTokenAddress, -100, 100, -110, constants);
        const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
        const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
        expect(vTokenPosition[0]).to.eq(0);
        expect(vBasePosition[0]).to.eq(0);
      });
    });
    describe('Upper limit order', () => {
      before(async () => {
        await test.cleanPositions(constants);
        await test.liquidityChange(vTokenAddress, -100, 100, 5, 2, constants);
        const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
        const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
        expect(vTokenPosition[0]).to.eq(-5);
        expect(vBasePosition[0]).to.eq(-20000);
      });
      it('Remove Failure - Inside Range (Upper Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, 90, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Failure - Below Range (Upper Limit)', async () => {
        expect(test.removeLimitOrder(vTokenAddress, -100, 100, -110, constants)).to.be.revertedWith(
          'IneligibleLimitOrderRemoval()',
        );
      });
      it('Remove Success - Above Range (Upper Limit)', async () => {
        test.removeLimitOrder(vTokenAddress, -100, 100, 110, constants);
        const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
        const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
        expect(vTokenPosition[0]).to.eq(0);
        expect(vBasePosition[0]).to.eq(0);
      });
    });

    // it('Remove Limit Order');
    // , async() => {
    //   await test.removeLimitOrder(vTokenAddress,-100,100,105);
    //   const vTokenPosition = await test.getAccountTokenDetails(vTokenAddress);
    //   const vBasePosition = await test.getAccountTokenDetails(vBaseAddress);
    //   expect(vTokenPosition[0]).to.eq('0');
    //   expect(vBasePosition[0]).to.eq(0);
    // });
  });
});
