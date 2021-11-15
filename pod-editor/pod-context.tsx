import * as React from "react";
import { PodNull, podSet, PodType, PodValue } from "./pod-editor-ast";

const { useContext, createContext } = React;

export const PodContext = createContext({
  names: new Map<number, string>(),
  root: {
    id: -1,
    pod: "literal",
    type: PodType.OBJECT,
    value: null,
  } as PodNull as PodValue,
  changePod(path: string[], value: PodValue) {},
  savePod(path: string[], value: PodValue) {},
  renamePod(id: number, name: string) {},
  cancelChangePod() {},
});

export const usePod = () => {
  return useContext(PodContext);
};

export const Provider = ({ getModule, save }) => {
  const [state, reduce] = React.useReducer(reducer, undefined, () => ({
    ...getModule(),
    modal: [],
    save,
  }));
  const P = PodContext.Provider;
  return (
    <P
      value={{
        names: state.names,
        root: state.root,
        changePod(path, value) {
          reduce({ type: PodActionType.CHANGE_MODAL_OPEN, path, value });
        },
        savePod(path, value) {
          reduce({ type: PodActionType.CHANGE_MODAL_SAVE, path, value });
        },
        renamePod(id, name) {
          reduce({ type: PodActionType.CHANGE_MODAL_RENAME, id, name });
        },
        cancelChangePod() {
          reduce({ type: PodActionType.CHANGE_MODAL_CANCEL });
        },
      }}
    ></P>
  );
};

function changePod({ setState }, context, path, value) {
  setState({
    ...context.state,
    modals: [...context.state.modals, { view: "change-pod", path, value }],
  });
}

function cancelChangePod({ setState }, context) {
  setState({
    ...context.state,
    modals: context.state.modals.slice(0, context.state.modals),
  });
}

function saveRoot({ setState }, context, root) {}

enum PodActionType {
  CHANGE_MODAL_OPEN = "changeModalOpen",
  CHANGE_MODAL_SAVE = "changeModalSave",
  CHANGE_MODAL_RENAME = "changeModalRename",
  CHANGE_MODAL_CANCEL = "changeModalCancel",
}

interface ChangeModalOpenAction {
  type: PodActionType.CHANGE_MODAL_OPEN;
  path: string[];
  value: PodValue;
}
interface ChangeModalSaveAction {
  type: PodActionType.CHANGE_MODAL_SAVE;
  path: string[];
  value: PodValue;
}
interface ChangeModalRenameAction {
  type: PodActionType.CHANGE_MODAL_RENAME;
  id: number;
  name: string;
}
interface ChangeModalCancelAction {
  type: PodActionType.CHANGE_MODAL_CANCEL;
}

type PodAction =
  | ChangeModalOpenAction
  | ChangeModalSaveAction
  | ChangeModalRenameAction
  | ChangeModalCancelAction;

enum PodModalView {
  CHANGE = "change",
}

interface ChangeModal {
  view: PodModalView.CHANGE;
  path: string[];
  value: PodValue;
}

type PodModal = ChangeModal;

interface PodModule {
  names: Map<number, string>;
  root: PodValue;
}

interface PodState {
  modal: PodModal[];
  names: Map<number, string>;
  root: PodValue;
  save(value: { names: Map<number, string>; root: PodValue }): void;
}

function reducer(state: PodState, action: PodAction): PodState {
  switch (action.type) {
    case PodActionType.CHANGE_MODAL_OPEN:
      return {
        ...state,
        modal: [
          ...state.modal,
          { view: PodModalView.CHANGE, path: action.path, value: action.value },
        ],
      };
    case PodActionType.CHANGE_MODAL_SAVE:
      const root = podSet(state.root, action.path, action.value);
      state.save({ names: state.names, root });
      return {
        ...state,
        modal: state.modal.slice(0, state.modal.length - 1),
      };
    case PodActionType.CHANGE_MODAL_RENAME:
      const names = new Map(state.names);
      names.set(action.id, action.name);
      return {
        ...state,
        names,
        modal: state.modal.slice(0, state.modal.length - 1),
      };
    case PodActionType.CHANGE_MODAL_CANCEL:
      return { ...state, modal: state.modal.slice(0, state.modal.length - 1) };
    default:
      throw new Error(`unknown action: ${action["type"]}`);
  }
}
