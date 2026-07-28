import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';

import { Card, Muted, Screen, Title } from '../../components/screen';
import { Button, Loading } from '../../components/ui';
import { env } from '../../config/env';
import { getNfcReader, type NfcDiagnosticsResult } from '../../services/nfc';

export function NfcDiagnosticsScreen() {
  const [result, setResult] = useState<NfcDiagnosticsResult>();
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState('');

  useEffect(
    () => () => {
      void getNfcReader().cancel();
    },
    [],
  );

  const read = async () => {
    setReading(true);
    setError('');
    try {
      setResult(await getNfcReader().readDiagnostics());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'NFC diagnostics failed');
    } finally {
      setReading(false);
    }
  };

  const provision = async () => {
    const userId = env.nfcProvisionUserId;
    if (!userId) {
      return;
    }

    setProvisioning(true);
    setError('');
    setProvisionMessage('');
    try {
      const provisionResult = await getNfcReader().provisionUserId(userId);
      setProvisionMessage(
        provisionResult.verified
          ? `Yazma ve anlık doğrulama başarılı (${provisionResult.bytesWritten}/${provisionResult.capacity} byte).`
          : `Yazma tamamlandı (${provisionResult.bytesWritten}/${provisionResult.capacity} byte). Kartı uzaklaştırıp yeniden okutarak doğrulayın.`,
      );
      setResult(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'NFC provisioning failed');
    } finally {
      setProvisioning(false);
    }
  };

  const confirmProvision = () => {
    Alert.alert(
      'Kart kaydı değiştirilecek',
      'Mevcut NDEF kaydı kaldırılıp yalnız HepAntalya test User UUID Text kaydı yazılacak. Kart formatlanmayacak ve salt-okunur yapılmayacak.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'UUID yaz', style: 'destructive', onPress: () => void provision() },
      ],
    );
  };

  const busy = reading || provisioning;

  return (
    <Screen scroll>
      <Title>NFC Diagnostics</Title>
      <Muted>
        Kart okuma varsayılandır. Yazma yalnız açık izin ve development hedef UUID’si ile yapılır;
        kart formatlanmaz veya salt-okunur yapılmaz.
      </Muted>
      {busy ? (
        <Loading />
      ) : (
        <>
          <Button onPress={() => void read()}>Kartı oku</Button>
          {env.nfcProvisionUserId ? (
            <Button onPress={confirmProvision} tone="danger">
              Test User UUID’sini karta yaz
            </Button>
          ) : null}
        </>
      )}
      {provisionMessage ? <Text>{provisionMessage}</Text> : null}
      {error ? <Text>{error}</Text> : null}
      {result ? (
        <Card>
          <Text>Tag ID: {result.tagId ?? 'yok'}</Text>
          <Text>Tech: {result.techTypes.join(', ') || 'bilinmiyor'}</Text>
          <Text>NDEF: {result.ndefSupported ? 'evet' : 'hayır'}</Text>
          <Text>User UUID: {result.canonicalUserId ?? 'çözülemedi'}</Text>
          <Text>Decode: {result.decodedPayload ?? '-'}</Text>
          <Text>Parser: {result.parserError ?? 'başarılı'}</Text>
          {result.records.map((record, index) => (
            <Text key={`${record.payloadHex}-${index}`}>
              Record {index + 1}: TNF {record.tnf}, type {record.type.join(',')}, payload{' '}
              {record.payloadHex}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
