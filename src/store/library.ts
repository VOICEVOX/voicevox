import { LibraryStoreState, LibraryStoreTypes } from "./type";
import { createPartialStore } from "./vuex";

export const libraryStoreState: LibraryStoreState = {
  libraryInstallStatuses: {},
  libraryFetchStatuses: {},
};

export const libraryStore = createPartialStore<LibraryStoreTypes>({
  START_LIBRARY_DOWNLOAD_AND_INSTALL: {
    async action(
      { dispatch },
      { engineId, libraryId, libraryName, libraryDownloadUrl }
    ) {
      await dispatch("UPDATE_LIBRARY_INSTALL_STATUS", {
        libraryId,
        status: {
          status: "pending",
        },
      });
      await window.electron.startLibraryDownloadAndInstall({
        engineId,
        libraryId,
        libraryName,
        libraryDownloadUrl,
      });
    },
  },

  UPDATE_LIBRARY_INSTALL_STATUS: {
    action: ({ commit }, { libraryId, status }) => {
      commit("SET_LIBRARY_INSTALL_STATUS", { libraryId, status });
    },
  },

  SET_LIBRARY_INSTALL_STATUS: {
    mutation: async (state, { libraryId, status }) => {
      state.libraryInstallStatuses = {
        ...state.libraryInstallStatuses,
        [libraryId]: status,
      };
    },
  },

  UNINSTALL_LIBRARY: {
    action: async ({ dispatch }, { engineId, libraryId }) => {
      await dispatch("UPDATE_LIBRARY_INSTALL_STATUS", {
        libraryId,
        status: { status: "uninstalling" },
      });

      await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then((instance) =>
          instance.invoke("uninstallLibraryUninstallLibraryLibraryUuidPost")({
            libraryUuid: libraryId,
          })
        )
        .catch((error) => {
          window.electron.logError(
            error,
            `Failed uninstalling library: ${libraryId}`
          );
          dispatch("UPDATE_LIBRARY_INSTALL_STATUS", {
            libraryId,
            status: { status: "error", message: error },
          });
          throw error;
        });

      await dispatch("UPDATE_LIBRARY_INSTALL_STATUS", {
        libraryId,
        status: { status: "done" },
      });
    },
  },

  SET_LIBRARY_FETCH_STATUS: {
    action: ({ commit }, { engineId, status }) => {
      commit("SET_LIBRARY_FETCH_STATUS", { engineId, status });
    },
    mutation: async (state, { engineId, status }) => {
      state.libraryFetchStatuses = {
        ...state.libraryFetchStatuses,
        [engineId]: status,
      };
    },
  },

  SET_SELECTED_LIBRARY: {
    action({ commit }, payload) {
      commit("SET_SELECTED_LIBRARY", payload);
    },
    mutation: (state, obj) => {
      state.selectedLibrary = obj;
    },
  },
});
