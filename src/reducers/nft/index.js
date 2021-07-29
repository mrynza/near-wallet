import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import set from 'lodash.set';
import { createSelector } from 'reselect';

import NonFungibleTokens from '../../services/NonFungibleTokens';

const { getLikelyTokenContracts, getMetadata, getTokens } = NonFungibleTokens;

const ENABLE_DEBUG = false;
const debugLog = (...args) => ENABLE_DEBUG && console.log('NFTSlice', ...args);

const nftSlice = createSlice({
        name: 'NFT',
        initialState: {
            ownedTokens: {
                byAccountId: {}
            },
            metadata: {
                byContractName: {}
            }
        },
        reducers: {
            setContractMetadata(state, { payload }) {
                const { metadata, contractName } = payload;
                set(state, ['metadata', 'byContractName', contractName], metadata);
            },
            setTokensMetadata(state, { payload }) {
                const { contractName, tokens, accountId } = payload;
                set(state, ['ownedTokens', 'byAccountId', accountId, 'byContractName', contractName], tokens);
            }
        }
    }
);

async function getCachedContractMetadataOrFetch(contractName, state) {
    let contractMetadata = selectOneContractMetadata(contractName)(state);
    if (contractMetadata) {
        debugLog('Returning cached contract metadata', { contractName });
        return contractMetadata;
    }
    debugLog('Fetching contract metadata', { contractName });
    return getMetadata(contractName);
}

const fetchNFTs = createAsyncThunk(
    'NFT/fetchNFTs',
    async ({ accountId }, thunkAPI) => {
        const { actions: { setContractMetadata, setTokensMetadata } } = nftSlice;
        const { dispatch, getState } = thunkAPI;

        const likelyContracts = await getLikelyTokenContracts(accountId);
        debugLog({ likelyContracts });

        await Promise.all(likelyContracts.map(async contractName => {
            try {
                const contractMetadata = await getCachedContractMetadataOrFetch(contractName, getState());
                debugLog({ contractMetadata });
                await dispatch(setContractMetadata({ contractName, metadata: contractMetadata }));

                const tokenMetadata = await getTokens({
                    accountId,
                    base_uri: contractMetadata.base_uri,
                    contractName
                });
                debugLog({ tokenMetadata });
                await dispatch(setTokensMetadata({ accountId, contractName, tokens: tokenMetadata }));
            } catch (e) {
                // Continue loading other likely contracts on failures
                console.warn(`Failed to load NFT for ${contractName}`, e);
            }
        }));
    }
);

export default nftSlice;

export const actions = {
    fetchNFTs,
    ...nftSlice.actions
};
export const reducer = nftSlice.reducer;

// A helper function to create the parameter selectors
// Ref: https://flufd.github.io/reselect-with-multiple-parameters/
function createParameterSelector(selector) {
    return (_, params) => selector(params);
}
const getAccountIdParam = createParameterSelector((params) => params.accountId);

// Top level selectors
const selectNftSlice = (state) => state.nft;
const selectMetadataSlice = createSelector(
    selectNftSlice,
    (nftSlice) => nftSlice.metadata
);
const selectOwnedTokensSlice = createSelector(
    selectNftSlice,
    (nftSlice) => nftSlice.ownedTokens
);
const selectOwnedTokensForAccount = createSelector(
    [selectOwnedTokensSlice, getAccountIdParam],
    (ownedTokensByAccountId, accountId) => (ownedTokensByAccountId.byAccountId[accountId] || {}).byContractName || {}
);

// Contract metadata selectors
// Returns contract metadata for every contract in the store, in an object keyed by contractName
export const selectAllContractMetadata = createSelector(
    selectMetadataSlice,
    (metadata) => metadata.byContractName
);

// Returns contract metadata for only the contractName provided
export const selectOneContractMetadata = (contractName) => createSelector(
    selectAllContractMetadata,
    (metadataByContractName) => metadataByContractName[contractName]
);

// Returns owned tokens metadata for all tokens owned by the passed accountId, sorted by their `name` property
export const selectTokensWithMetadataForAccountId = createSelector(
    [selectAllContractMetadata, selectOwnedTokensForAccount],
    (metadataByContractName, ownedTokensByContractName) => {
        debugLog('selectTokensWithMetadataForAccountId()');
        const sortedOwnedTokensWithContractMetadata = Object.entries(ownedTokensByContractName || {})
            // First, sort the tokens this account owns by their `name` metadata
            .sort(([contractNameA], [contractNameB]) => {
                const contractMetadataNameA = metadataByContractName[contractNameA].name;
                const contractMetadataNameB = metadataByContractName[contractNameB].name;
                return contractMetadataNameA.localeCompare(contractMetadataNameB);
            })
            .map(([contractName, ownedTokensMetadata]) => ({
                contractName,
                contractMetadata: metadataByContractName[contractName] || {},
                ownedTokensMetadata
            }));

        return sortedOwnedTokensWithContractMetadata;
    }
);