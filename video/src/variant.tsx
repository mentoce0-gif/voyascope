// いまどちらの版を描いているか（ひまわり版／流星群版）。Root が Composition ごとに渡す
import React, {createContext, useContext} from 'react';
import type {Variant} from './script';

const Ctx = createContext<Variant>('himawari');
export const VariantProvider: React.FC<{v: Variant; children: React.ReactNode}> = ({v, children}) => <Ctx.Provider value={v}>{children}</Ctx.Provider>;
export const useVariant = () => useContext(Ctx);
