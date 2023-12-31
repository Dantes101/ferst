/* eslint-disable no-restricted-globals */
import { LaTiaoError, LaTiaoNameError } from "./error";
import './operator';
import './implement/index';
import parse from "./parse";
import exec from './exec';
import type { FieldToken, FieldType } from "./token";
import type { LaTiaoProgramContext, CreateLaTiaoProgramProps, CreateLaTiaoProgramResult, ILaTiaoColumn, LaTiaoErrorLocation, Static, ExecuteLaTiaoProgramResult, LaTiaoProgramProps } from "./types";


const programStores = new Map<number, LaTiaoProgramContext>();
let programCount = 0;

const createProgram = (data: CreateLaTiaoProgramProps['data']): (
  | { success: true; data: CreateLaTiaoProgramResult }
  | { success: false; message: string }
) => {
  try {
    const programId = programCount++;

    const originData = data;
    const tempData: ILaTiaoColumn<FieldType>[] = [];
    const rowCount = data[0]?.data.length ?? 0;

    const resolveColId = (colId: string, loc: LaTiaoErrorLocation): Static<FieldToken> => {
      const fieldAsOrigin = originData.find(col => col.info.token.fid === colId);
      if (fieldAsOrigin) {
        return fieldAsOrigin.info.token;
      }
      const fieldAsTemp = tempData.find(col => col.info.token.fid === colId);
      if (fieldAsTemp) {
        return fieldAsTemp.info.token;
      }
      throw new LaTiaoNameError(`Cannot find column "${colId}"`, loc);
    };

    const col = (async <
      T extends FieldType = FieldType,
      D extends T extends 'collection' ? string[] : number[] = T extends 'collection' ? string[] : number[],
    >(field: Static<FieldToken<T>>, loc?: LaTiaoErrorLocation): Promise<Static<D>> => {
      const { fid: colId } = field;
      const fieldAsOrigin = originData.find(col => col.info.token.fid === colId);
      if (fieldAsOrigin) {
        return fieldAsOrigin.data as Static<D>;
      }
      const fieldAsTemp = tempData.find(col => col.info.token.fid === colId);
      if (fieldAsTemp) {
        return fieldAsTemp.data as Static<D>;
      }
      throw new LaTiaoNameError(`Cannot find column "${colId}"`, loc);
    }) as LaTiaoProgramContext['col'];

    const cols = async <
      T extends FieldType[] = FieldType[],
      D extends {
        [index in keyof T]: T extends 'collection' ? string[] : number[]
      } = {
        [index in keyof T]: T extends 'collection' ? string[] : number[]
      },
    >(fields: Static<{ [index in keyof T]: FieldToken<T[index]> }>, loc?: LaTiaoErrorLocation): Promise<Static<D>> => {
      const res = await Promise.all(fields.map(f => context.col(f, loc)));
      return res as Static<D>;
    };

    const write = (<
      T extends FieldType = FieldType,
      D extends T extends 'collection' ? string[] : T extends 'bool' ? (0 | 1)[] : number[] = T extends 'collection' ? string[] : T extends 'bool' ? (0 | 1)[] : number[],
    >(
      field: FieldToken<T>,
      data: D,
    ): void => {
      if ([...originData, ...tempData].find(col => col.info.token.fid === field.fid)) {
        throw new LaTiaoNameError(`Column ${field.fid} already existed.`);
      }
      tempData.push({
        info: { token: field },
        data,
      });
    }) as LaTiaoProgramContext['write'];

    let reportError = (err: LaTiaoError): void => {
      throw err;
    };

    const context: LaTiaoProgramContext = {
      programId,
      originData,
      tempData: [],
      rowCount,
      resolveColId,
      col,
      cols,
      write,
      reportError,
    };

    programStores.set(programId, context);

    const res: CreateLaTiaoProgramResult = {
      programId,
    };

    return {
      success: true,
      data: res,
    };
  } catch (error) {
    return {
      success: false,
      message: `${error}`
    };
  }
};

const execute = async (programId: number, source: string): Promise<(
  | { success: true; data: ExecuteLaTiaoProgramResult }
  | { success: false; message: string }
)> => {
  try {
    const context = programStores.get(programId);
    if (!context) {
      throw new Error(`Program id not found: ${programId}`);
    }
    const ast = parse(source, context);

    const expArr = await exec(ast, context);

    const enter = expArr.map(fid => context.resolveColId(fid));
    const data = await context.cols(enter);

    return {
      success: true,
      data: { data: [], enter, columns: data },
    };
  } catch (error) {
    return {
      success: false,
      message: `${error}`
    };
  }
};

const destroyProgram = (programId: number): (
  | { success: true; data: true }
  | { success: false; message: string }
) => {
  try {
    if (programStores.delete(programId)) {
      return { success: true, data: true };
    }
    throw new Error(`Program id not found: ${programId}`);
  } catch (error) {
    return {
      success: false,
      message: `${error}`
    };
  }
};

const router = async (e: MessageEvent<LaTiaoProgramProps>) => {
  const { data } = e;

  switch (data.task) {
    case 'createProgram': {
      return self.postMessage(
        createProgram(data.data)
      );
    }
    case 'execute': {
      return self.postMessage(
        await execute(data.programId, data.source)
      );
    }
    case 'destroyProgram': {
      return self.postMessage(
        destroyProgram(data.programId)
      );
    }
    default: {
      return self.postMessage({
        success: false,
        message: `${new Error(`Unknown task: ${(data as any).task}.`)}`,
      });
    }
  }
};

self.addEventListener('message', router, false);
