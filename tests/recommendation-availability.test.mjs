import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendationAvailable } from "../lib/tools/recommendation-availability.ts";
import { aiRecommendationsPolicy } from "../config/ai-recommendations.ts";

const configured={AI_RECOMMENDATIONS_ENABLED:"true",OPENAI_API_KEY:"fixture-key-not-a-secret",OPENAI_MODEL:"gpt-5.4-mini-2026-03-17"};
test("availability requires all gates; missing or invalid configuration fails closed",()=>{
 for(const env of [{},{...configured,AI_RECOMMENDATIONS_ENABLED:undefined},{...configured,AI_RECOMMENDATIONS_ENABLED:"false"},{...configured,AI_RECOMMENDATIONS_ENABLED:"1"},{...configured,OPENAI_API_KEY:""},{...configured,OPENAI_API_KEY:"  "},{...configured,OPENAI_API_KEY:undefined},{...configured,OPENAI_MODEL:undefined},{...configured,OPENAI_MODEL:"unapproved-model"}])assert.equal(recommendationAvailable(env,true),false);
});
test("legal gate blocks otherwise configured integration and remains disabled in this release",()=>{
 assert.equal(recommendationAvailable(configured,false),false);
 assert.equal(aiRecommendationsPolicy.externalProcessingApproved,false);
 assert.equal(recommendationAvailable(configured,aiRecommendationsPolicy.externalProcessingApproved),false);
});
test("approved fixtures return a boolean only, without disclosing key or configuration",()=>{
 assert.equal(recommendationAvailable(configured,true),true);
 assert.equal(recommendationAvailable({...configured,OPENAI_MODEL:"gpt-5.4-mini"},true),true);
 assert.equal(JSON.stringify({openAiAvailable:recommendationAvailable(configured,true)}),'{"openAiAvailable":true}');
});
