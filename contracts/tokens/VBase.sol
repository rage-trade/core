//SPDX-License-Identifier: UNLICENSED

// pragma solidity ^0.7.6;

// if importing uniswap v3 libraries this might not work
pragma solidity ^0.8.9;
import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { IVBase } from '../interfaces/IVBase.sol';

contract VBase is IVBase, ERC20('Virtual Base Token', 'vBase'), Ownable {
    mapping(address => bool) public isAuth;

    address public immutable realBase;
    uint8 immutable _decimals;

    constructor(address realBase_) {
        realBase = realBase_;
        _decimals = ERC20(realBase_).decimals();
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function authorize(address vPoolWrapper) external onlyOwner {
        isAuth[vPoolWrapper] = true;
    }

    error Unauthorised();

    function mint(address account, uint256 amount) external {
        if (!isAuth[msg.sender]) {
            revert Unauthorised();
        }
        _mint(account, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
