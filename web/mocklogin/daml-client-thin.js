/**
 * A really thin HTTP JSON API client that makes some fairly unrealistic assumptions:
 *
 *  * HTTP JSON API server and its underlying ledger are not enforcing auth
 *  * HTTP JSON API server is available from the root of the current domain (i.e., through our dev proxy).
 *  * Real error handling isn't _too_ important, because this is just for local development anyway
 *
 * @typedef PartyDetails
 * @property {string} displayName
 * @property {string} identifier
 *
 * @typedef AllocatePartyRequest
 * @property {string?} identifierHint
 * @property {string?} displayName
 *
 * @typedef User
 * @property {string} userId
 *
 * @typedef CreateUserRequest
 * @property {string} userId
 * @property {string} primaryParty
 * @property {(CanActAs | CanReadAs)[]} rights
 *
 * @typedef CanActAs
 * @property {'CanActAs'} type
 * @property {string} party
 *
 * @typedef CanReadAs
 * @property {'CanActAs'} type
 * @property {string} party
 */

var BASE_URL = "";

export function setBaseUrl(baseUrl) {
  BASE_URL = baseUrl;
}

/**
 * List all known parties.
 *
 * @returns {Promise<PartyDetails[]>}
 */
export async function listKnownParties() {
  // read all parties from the HTTP JSON API as a convenience;
  // we assume we're running locally against an un-authed ledger,
  // so a valid token is not actually required in the Authorization header
  const response = await fetch(BASE_URL + "/v1/parties", {
    headers: { Authorization: "Bearer _" },
  });
  return (await response.json()).result;
}

/**
 * Allocate a party.
 *
 * @param {AllocatePartyRequest?} options
 * @returns {Promise<PartyDetails>}
 */
export async function allocateParty(options) {
  const response = await fetch(BASE_URL + "/v1/parties/allocate", {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer _",
    },
    method: "POST",
    body: JSON.stringify(options || {}),
  });
  return await response.json();
}

/**
 * Get a user.
 *
 * @param {string} userId
 * @returns {Promise<User>}
 */
export async function getUser(userId) {
  const response = await fetch(BASE_URL + "/v1/user", {
    method: "POST",
    body: { userId },
  });
  return await response.json();
}

/**
 * @param {CreateUserRequest} user
 * @returns Promise<void>
 */
export async function createUser(user) {
  await fetch(BASE_URL + "/v1/user/create", { body: user });
}
