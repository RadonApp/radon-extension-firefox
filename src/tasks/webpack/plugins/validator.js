import IsNil from 'lodash-es/isNil';


export default class ValidatorPlugin {
    constructor(validator, environment) {
        this.validator = validator;
        this.environment = environment;
    }

    apply(compiler) {
        compiler.plugin("compilation", compilation => {
            compilation.plugin("after-optimize-chunks", (chunks) => {
                // Process named chunks
                let count = 0;

                chunks.forEach((chunk) => {
                    if(IsNil(chunk.name)) {
                        return;
                    }

                    // Process modules
                    chunk.modules.forEach((module) =>
                        this.validator.processModule(this.environment, module)
                    );

                    count++;
                });

                // Finish module validation
                if(count > 0) {
                    this.validator.finish(this.environment);
                }
            });
        });
    }
}
