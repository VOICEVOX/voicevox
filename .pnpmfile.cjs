function readPackage(pkg, context) {
  // NOTE: @storybook/vue3はvue-component-type-helpersのlatestを要求しており、minimumReleaseAgeと相性が悪いので、ここで置き換える。
  if (pkg.name === "@storybook/vue3") {
    const deps = pkg.dependencies;
    if (deps["vue-component-type-helpers"] === "latest") {
      deps["vue-component-type-helpers"] = "~3.0.0";
      context.log(
        "vue-component-type-helpers@latest => vue-component-type-helpers@~3.0.0 in dependencies of @storybook/vue3",
      );
    }
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
