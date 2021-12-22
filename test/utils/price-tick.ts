import { FakeContract, MockContract } from '@defi-wonderland/smock';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { TickMath } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import { VBase, VToken } from '../../typechain-types';
import { fromQ128, fromQ96, Q96, toQ128, toQ96 } from './fixed-point';

export declare type ContractOrSmock<C extends Contract> = C | MockContract<C> | FakeContract<C>;

export async function priceToTick(
  price: number,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): Promise<number> {
  // console.log('price', price);
  const vBaseDecimals = await vBase.decimals();
  const vTokenDecimals = await vToken.decimals();
  price *= 10 ** (vBaseDecimals - vTokenDecimals);
  if (!BigNumber.from(vBase.address).gt(vToken.address)) {
    price = 1 / price;
  }

  const tick = TickMath.getTickAtSqrtRatio(JSBI.BigInt(toQ96(Math.sqrt(price)).toHexString()));
  // console.log('tick', tick);
  return tick;
}

export function sqrtPriceX96ToTick(sqrtPriceX96: BigNumberish): number {
  sqrtPriceX96 = BigNumber.from(sqrtPriceX96);
  const tick = TickMath.getTickAtSqrtRatio(JSBI.BigInt(sqrtPriceX96.toHexString()));
  return tick;
}

export async function tickToPrice(
  tick: number,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): Promise<number> {
  let price = fromQ96(BigNumber.from(TickMath.getSqrtRatioAtTick(tick).toString())) ** 2;
  if (!BigNumber.from(vBase.address).gt(vToken.address)) {
    price = 1 / price;
  }
  const vBaseDecimals = await vBase.decimals();
  const vTokenDecimals = await vToken.decimals();
  price /= 10 ** (vBaseDecimals - vTokenDecimals);
  return price;
}
export function tickToSqrtPriceX96(tick: number): BigNumber {
  let sqrtPriceX96 = BigNumber.from(TickMath.getSqrtRatioAtTick(tick).toString());
  return sqrtPriceX96;
}

/**
 * Parses human readable prices to fixed point 128
 * and also applies the decimals.
 * @param price Human readable price
 * @param vBase VBase contract for quering decimals
 * @param vToken VToken contract for quering decimals
 * @returns fixed point 128 and decimals applied price
 */
export async function priceToPriceX128(
  price: number,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): Promise<BigNumber> {
  const vBaseDecimals = await vBase.decimals();
  const vTokenDecimals = await vToken.decimals();

  let priceX128 = toQ128(price);

  priceX128 = priceX128.mul(BigNumber.from(10).pow(vBaseDecimals)).div(BigNumber.from(10).pow(vTokenDecimals));
  // if (!BigNumber.from(vBase.address).gt(vToken.address)) {
  //   price = 1 / price;
  // }
  return priceX128;
}

/**
 * Formats the fixed point price into human readable
 * @param priceX128 fixed point 128 and decimals applied price
 * @param vBase VBase contract for quering decimals
 * @param vToken VToken contract for quering decimals
 * @returns human readable price
 */
export async function priceX128ToPrice(
  priceX128: BigNumberish,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): Promise<number> {
  priceX128 = BigNumber.from(priceX128);
  let price: number = fromQ128(priceX128);
  // if (!BigNumber.from(vBase.address).gt(vToken.address)) {
  //   price = 1 / fromQ128(priceX128);
  // }
  const vBaseDecimals = await vBase.decimals();
  const vTokenDecimals = await vToken.decimals();
  price /= 10 ** (vBaseDecimals - vTokenDecimals);
  return price;
}

/**
 * Converts priceX128 (vBase per vToken) into sqrtPriceX96 (token1 per token0)
 * @param priceX128 fixed point 128 and decimals applied price
 * @param vBase VBase contract determining the token0-token1
 * @param vToken VToken contract determining the token0-token1
 * @returns sqrtPriceX96 for use in uniswap
 */
export function priceX128ToSqrtPriceX96(
  priceX128: BigNumberish,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): BigNumber {
  priceX128 = BigNumber.from(priceX128);
  let sqrtPriceX96 = sqrt(priceX128.mul(1n << 64n)); // 96 = (128 + 64) / 2

  if (!BigNumber.from(vBase.address).gt(vToken.address)) {
    sqrtPriceX96 = Q96.mul(Q96).div(sqrtPriceX96);
  }
  return sqrtPriceX96;
}

export function sqrtPriceX96ToPriceX128(
  sqrtPriceX96: BigNumberish,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): BigNumber {
  sqrtPriceX96 = BigNumber.from(sqrtPriceX96);
  if (!BigNumber.from(vBase.address).gt(vToken.address)) {
    sqrtPriceX96 = Q96.mul(Q96).div(sqrtPriceX96);
  }
  let priceX128 = sqrtPriceX96.mul(sqrtPriceX96).div(1n << 64n);
  return priceX128;
}

export async function priceToSqrtPriceX96(
  price: number,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
) {
  let priceX128 = await priceToPriceX128(price, vBase, vToken);
  return priceX128ToSqrtPriceX96(priceX128, vBase, vToken);
}

export async function priceToSqrtPriceX96WithoutContract(
  price: number,
  vBaseDecimals: BigNumberish,
  vTokenDecimals: BigNumberish,
  isToken0: boolean,
) {
  let priceX128 = toQ128(price);

  priceX128 = priceX128.mul(BigNumber.from(10).pow(vBaseDecimals)).div(BigNumber.from(10).pow(vTokenDecimals));
  priceX128 = BigNumber.from(priceX128);
  let sqrtPriceX96 = sqrt(priceX128.mul(1n << 64n)); // 96 = (128 + 64) / 2

  if (isToken0) {
    sqrtPriceX96 = Q96.mul(Q96).div(sqrtPriceX96);
  }
  return sqrtPriceX96;
}

export async function sqrtPriceX96ToPrice(
  sqrtPriceX96: BigNumberish,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
) {
  const priceX128 = sqrtPriceX96ToPriceX128(sqrtPriceX96, vBase, vToken);
  return priceX128ToPrice(priceX128, vBase, vToken);
}

export function initializableTick(tick: number, tickSpacing: number) {
  return Math.floor(tick / tickSpacing) * tickSpacing;
}

export async function priceToNearestPriceX128(
  price: number,
  vBase: ContractOrSmock<VBase>,
  vToken: ContractOrSmock<VToken>,
): Promise<BigNumber> {
  return sqrtPriceX96ToPriceX128(tickToSqrtPriceX96(await priceToTick(price, vBase, vToken)), vBase, vToken);
}

const ONE = BigNumber.from(1);
const TWO = BigNumber.from(2);

function sqrt(value: BigNumberish) {
  const x = BigNumber.from(value);
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}
