import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {createSandboxPayment, verifySandboxPayment} from "../lib/server/commerce/yookassa-sandbox.ts";

const keys = {shopId:"1534248",secretKey:"test_" + "a".repeat(35)};
const order = () => ({orderId:randomUUID(),idempotenceKey:randomUUID(),returnOrigin:"https://mironovich.pro/"});
const provider = (o, extra={}) => ({
  id:randomUUID(),status:"pending",paid:false,test:true,
  amount:{value:"1990.00",currency:"RUB"},
  metadata:{order_id:o.orderId},
  confirmation:{confirmation_url:"https://yoomoney.ru/api-pages/v2/payment-confirm/xxx"},
  ...extra,
});
const fakeFetch = (response, onRequest) => async (url, init) => {
  onRequest?.(url,init);
  return {ok:true,status:200,json:async()=>response};
};

test("creates test payment at fixed RUB 1990 without PII and returns redirect", async()=>{
  const o=order(); const payment=provider(o);
  const result=await createSandboxPayment(o,keys,fakeFetch(payment,(url,init)=>{
    assert.equal(url,"https://api.yookassa.ru/v3/payments");
    assert.equal(init.method,"POST");
    assert.equal(init.headers["Idempotence-Key"],o.idempotenceKey);
    const payload=JSON.parse(init.body);
    assert.equal(payload.amount.value,"1990.00");
    assert.equal(payload.amount.currency,"RUB");
    assert.deepEqual(payload.metadata,{order_id:o.orderId});
    assert.equal(payload.confirmation.return_url,"https://mironovich.pro/payment/result");
    assert.equal(JSON.stringify(payload).includes("@"),false);
  }));
  assert.equal(result.sandbox,true);
  assert.equal(result.paymentId,payment.id);
});

test("rejects live keys and responses from a real shop", async()=>{
  const o=order();
  await assert.rejects(createSandboxPayment(o,{shopId:"1534248",secretKey:"live_example_example"},fakeFetch(provider(o))),/TEST key/);
  await assert.rejects(createSandboxPayment(o,keys,fakeFetch(provider(o,{test:false}))),/does not match/);
});

test("rejects incorrect prices and foreign order ids", async()=>{
  const o=order();
  await assert.rejects(createSandboxPayment(o,keys,fakeFetch(provider(o,{amount:{value:"1.00",currency:"RUB"}}))),/does not match/);
  await assert.rejects(createSandboxPayment(o,keys,fakeFetch(provider(o,{metadata:{order_id:randomUUID()}}))),/does not match/);
});

test("rejects untrusted return URL and an invalid idempotence key", async()=>{
  const o=order();
  await assert.rejects(createSandboxPayment({...o,returnOrigin:"https://evil.example/"},keys,fakeFetch(provider(o))),/Unsupported return origin/);
  await assert.rejects(createSandboxPayment({...o,idempotenceKey:"unsafe"},keys,fakeFetch(provider(o))),/expected UUID/);
});

test("only authenticated GET of paid+succeeded can mark a sandbox order",async()=>{
  const o=order();const id=randomUUID();const statuses=[];
  for(const [status,paid,expected] of [["pending",false,false],["succeeded",false,false],["succeeded",true,true],["canceled",false,false]]){
    const result=await verifySandboxPayment(id,o.orderId,keys,fakeFetch(provider(o,{id,status,paid}),(url,init)=>{
      assert.equal(url,"https://api.yookassa.ru/v3/payments/"+id);
      assert.equal(init.method,"GET");
    }));
    statuses.push(result.eligibleForTestOrderMarking);
    assert.equal(result.verifiedTestPayment,true);
    assert.equal(result.status,status);
    assert.equal(result.eligibleForTestOrderMarking,expected);
  }
  assert.deepEqual(statuses,[false,false,true,false]);
});
test("does not leak provider response body on error",async()=>{
  const o=order();
  await assert.rejects(createSandboxPayment(o,keys,async()=>({ok:false,status:401,json:async()=>({secret:"do-not-log"})})),e=>{
    assert.equal(e.message,"ЮKassa sandbox request failed with HTTP 401");
    return true;
  });
});
