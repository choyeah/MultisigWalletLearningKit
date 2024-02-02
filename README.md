# MultisigWallet

## 개념

Multi Sig Wallet은 솔리디티로 작성된 컨트랙트 지갑이다. 이 컨트랙트 지갑은 컨트랙트에 보유된 코인을 전송할때 여러명의 Owner의 허가가 있어야지만 전송이 가능하다. 오너의 수와 몇명의 오너가 허용해야 하는지는 컨트랙트 생성시에 인자로 적용하거나 이를 수정할 수 있는 권한의 사용자가 수정할 수 있다.

이런 메커니즘은 단일 주소의 승인만으로 발생할 수 있는 보안 취약점을 줄이고, 복수의 승인 과정을 통해 보다 안전한 트랜잭션 처리를 가능하게 한다. 주로 대규모 자금이 관리되는 금융 서비스, 중요한 거래를 처리하는 데 필요한 플랫폼에서 사용된다.

## 특징 및 장점

보안성 강화: 여러 개의 키가 필요하기 때문에, 단일 키의 손실이나 해킹으로 인한 위험을 줄일 수 있다.
분산된 권한: 트랜잭션 승인 권한을 여러 주체에 분산시켜, 권한 남용을 방지한다.
유연한 권한 관리: 특정 조건에 따라 권한을 조정하고, 다양한 시나리오에 맞춰 권한을 설정할 수 있다.

## 코드 살펴보기

멀티시그 월렛의 정석이라 평가되는 Gnosis MultiSigWallet 컨트랙트를 기준으로 코드를 확인해보자. https://github.com/gnosis/MultiSigWallet

Gnosis MultiSigWallet은 작성된지 5년이 지났지만 지금도 이 컨트랙트는 멀티시그 월렛의 표준으로 참고된다고 한다. 이 컨트랙트는 consensys의 Stefan George가 최초로 작성한것을 Gnosis에서 수정한 것이다.

그리고 아래에서 살펴볼 코드는 Gnosis MultiSigWallet 컨트랙트를 체인의 정석님이 관리자 권한 설정과 같은 부수적인 내용을 제거한 핵심 코드만을 추려 최근 솔리디티 버전으로 업데이트한 컨트랙트 코드이다.

### 코드 흐름

멀티시그월렛 컨트랙트 주요 로직의 큰 흐름

    1) 트랜잭션 등록
    2-1) 트랜잭션 컨펌
    2-2) 컨펌 허용 횟수를 만족할 경우 트랜잭션 자동 실행

1. 제안자 한 명이 트랜잭션을 등록한다. 이때 누구에게, 얼마만큼의 이더를, 어떤 데이터와 함께 보낼지를 인자로 전달한다.

```
    function submitTransaction(address destination, uint value, bytes memory data)
        public
        returns (uint transactionId)
    {
        transactionId = addTransaction(destination, value, data);
        confirmTransaction(transactionId);
    }
```

> destination으로, value 만큼의 이더를, data와 함께 트랜잭션을 실행하며 트랜잭션 아이디를 리턴한다.

2-1. 제안자 외 권한을 가진 계정 N명이 confirmTransaction함수를 호출하여 트랜잭션을 수락한다.

- 수락 대상의 등록된 트랜잭션 아이디를 인자로 전달하고, confirmations 를 하나씩 증가하게 만든다.

```
    function confirmTransaction(uint transactionId)
        public
        ownerExists(msg.sender)
        transactionExists(transactionId)
        notConfirmed(transactionId, msg.sender)
    {
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
        executeTransaction(transactionId);
    }
```

2-2. 컨펌 허용 횟수를 만족할 경우 트랜잭션이 실행된다.
만약 트랜잭션 수락 횟수가 미리 지정한 confirmation number를 초과할 경우 자동적으로 트랜잭션이 실행된다.

```
    function executeTransaction(uint transactionId)
        public
        ownerExists(msg.sender)
        confirmed(transactionId, msg.sender)
        notExecuted(transactionId)
    {
        if (isConfirmed(transactionId)) {
            Transaction storage txn = transactions[transactionId];
            txn.executed = true;
            if (external_call(txn.destination, txn.value, txn.data.length, txn.data))
                emit Execution(transactionId);
            else {
                emit ExecutionFailure(transactionId);
                txn.executed = false;
            }
        }
    }
```

컨펌 횟수를 만족하는지에 대한 조건 검사는 isConfirmed()에서 진행된다.

```
    function isConfirmed(uint transactionId)
        public
        view
        returns (bool)
    {
        uint count = 0;
        for (uint i=0; i<owners.length; i++) {
            if (confirmations[transactionId][owners[i]])
                count += 1;
            if (count == required)
                return true;
        }
        return false;
    }
```

> confirmations[transactionId]owners[i]]를 통해 허가가 완료된 횟수를 1씩 카운트업 하다가,
> required로 지정된 숫자에 도달하는 순간 true를 리턴, 아니라면 false를 리턴한다.

isConfirmed() 함수가 true를 리턴하게되면 external_call()을 호출하여 송금 처리한다.

```
function external_call(address destination, uint value, uint dataLength, bytes memory data) internal returns (bool) {
        bool result;
        assembly {
            let x := mload(0x40)   // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
                sub(gas(), 34710),   // 34710 is the value that solidity is currently emitting
                                   // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
                                   // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
                destination,
                value,
                d,
                dataLength,        // Size of the input (in bytes) - this is what fixes the padding problem
                x,
                0                  // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }
```

전체코드 링크

## multisig 배포하기

생성자에 지갑 주소와 confirmation number를 지정해 주고 배포

```
npx hardhat run scripts/deploy.ts
```

## 멀티시그 컨트렉트 테스트

```
npx hardhat test test/MultisigTest.ts
```
