export type RPCSerializableValue =
    | { [property: string]: RPCSerializableValue }
    | readonly RPCSerializableValue[]
    | string
    | number
    | boolean
    | null
    | void;
