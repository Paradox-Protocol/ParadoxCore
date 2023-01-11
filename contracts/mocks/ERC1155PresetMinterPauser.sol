// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
/**
 * @dev {ERC1155} token, including:
 *
 *  - ability for holders to burn (destroy) their tokens
 *  - a minter role that allows for token minting (creation)
 *  - a pauser role that allows to stop all token transfers
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 *
 * _Deprecated in favor of https://wizard.openzeppelin.com/[Contracts Wizard]._
 */
contract ERC1155PresetMinterPauser is Context, Initializable, AccessControlEnumerable, ERC1155Burnable, ERC1155Supply {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, and `PAUSER_ROLE` to the account that
     * deploys the contract.
     */
    constructor(string memory uri) ERC1155(uri) {
    }

    function initialize(address defaultAdmin_, address minter_, string memory uri_) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, defaultAdmin_);
        _setupRole(MINTER_ROLE, minter_);
        _setURI(uri_);
    }

    /**
     * @dev Creates `amount` new tokens for `to`, of token type `id`.
     *
     * See {ERC1155-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC1155PresetMinterPauser: must have minter role to mint");

        _mint(to, id, amount, data);
    }

    /**
     * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] variant of {mint}.
     */
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC1155PresetMinterPauser: must have minter role to mint");

        _mintBatch(to, ids, amounts, data);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC1155)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setUri(string memory uri_) public virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC1155PresetMinterPauser: must have minter role to set uri");

        _setURI(uri_);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}