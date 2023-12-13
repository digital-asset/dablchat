import {User, PartyInfo, UserRight} from "@daml/ledger";

interface AllocatePartyRequest {
    displayName?: string
    identifierHint?: string;
}

interface CreateUserRequest {
    userId: string
    primaryParty: string
    rights: UserRight
}

export function setBaseUrl(url: string): void;

export async function listKnownParties(): Promise<PartyInfo[]>;

export async function allocateParty(request: AllocatePartyRequest): Promise<PartyInfo>;

export async function getUser(userId: string): Promise<User>;

export async function createUser(request: CreateUserRequest): Promise<void>;
