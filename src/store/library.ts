import { LibraryStoreState, LibraryStoreTypes } from "./type";
import { createPartialStore } from "./vuex";

export const libraryStoreState: LibraryStoreState = {
  libraryInstallStatuses: {},
};

export const libraryStore = createPartialStore<LibraryStoreTypes>({
  START_LIBRARY_DOWNLOAD: {
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
      await window.electron.startLibraryDownload({
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

  SET_SELECTED_LIBRARY: {
    action({ commit }, payload) {
      commit("SET_SELECTED_LIBRARY", payload);
    },
    mutation: (state, obj) => {
      state.selectedLibrary = obj;
    },
  },
});
